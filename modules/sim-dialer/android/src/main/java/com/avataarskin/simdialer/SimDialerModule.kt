package com.avataarskin.simdialer

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Android half of `SimDialer`. The JS contract lives in `modules/sim-dialer/index.ts`; function
 * names, arguments and event payloads here must match `ios/SimDialerModule.swift` exactly.
 *
 * Calls go out on the phone's own SIM:
 *  - CALL_PHONE granted → TelecomManager.placeCall: dials immediately, on the chosen SIM if any.
 *  - not granted        → ACTION_DIAL: opens the dialer with the number filled in; agent taps call.
 *
 * Call state comes from TelephonyCallback (Android 12+, needs READ_PHONE_STATE) or
 * PhoneStateListener (older). Android reports IDLE / OFFHOOK / RINGING only: it cannot tell whether
 * the other side answered, and OFFHOOK starts while the outgoing call is still ringing. Talk time
 * therefore comes from the call log after the call (READ_CALL_LOG): its DURATION is the time
 * after the other side answered, 0 when they didn't.
 */
class SimDialerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val telephony: TelephonyManager
    get() = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

  private val telecom: TelecomManager
    get() = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager

  /** TelephonyCallback (API 31+) or PhoneStateListener (older). Null while not tracking. */
  @Volatile private var listener: Any? = null
  private val main = Handler(Looper.getMainLooper())

  /** Pending `pickRecordingsFolder` promise, resolved from OnActivityResult. */
  @Volatile private var pendingPick: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("SimDialer")

    Events("callState", "sharedRecording")

    OnCreate { startTracking() }

    OnDestroy { stopTracking() }

    AsyncFunction("getPermissions") { promise: Promise ->
      Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise, *PERMISSIONS)
    }

    AsyncFunction("requestPermissions") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, *PERMISSIONS)
    }

    AsyncFunction("capabilities") {
      mapOf(
        "platform" to "android",
        "canDirectDial" to isGranted(Manifest.permission.CALL_PHONE),
        "canTrack" to (listener != null),
        "canChooseSim" to isGranted(Manifest.permission.READ_PHONE_STATE),
        "canReadCallLog" to isGranted(Manifest.permission.READ_CALL_LOG),
      )
    }

    /** Call after permissions are granted; tracking can't start before READ_PHONE_STATE on 12+. */
    AsyncFunction("startTracking") {
      startTracking()
      listener != null
    }

    AsyncFunction("getCallState") { currentState() }

    AsyncFunction("listSims") { listSims() }

    AsyncFunction("placeCall") { number: String, simId: String? ->
      placeCall(number, simId)
    }

    /** Latest outgoing call to `number` placed at or after `sinceMs`, from the call log; null if none. */
    AsyncFunction("lastCallFromLog") { number: String, sinceMs: Double ->
      lastCallFromLog(number, sinceMs)
    }

    /** Opens the system folder picker; resolves {uri, name} or null when cancelled. Read access only. */
    AsyncFunction("pickRecordingsFolder") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject(CodedException("E_NO_ACTIVITY", "No screen to show the folder picker on.", null))
      } else {
        pendingPick?.resolve(null)
        pendingPick = promise
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(
          Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        )
        try {
          activity.startActivityForResult(intent, PICK_FOLDER_REQUEST)
        } catch (e: ActivityNotFoundException) {
          pendingPick = null
          promise.reject(CodedException("E_NO_PICKER", "This phone has no folder picker.", null))
        }
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == PICK_FOLDER_REQUEST) {
        val promise = pendingPick
        pendingPick = null
        val uri = if (payload.resultCode == Activity.RESULT_OK) payload.data?.data else null
        if (promise != null) {
          if (uri == null) {
            promise.resolve(null)
          } else {
            try {
              context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
              promise.resolve(mapOf("uri" to uri.toString(), "name" to folderName(uri)))
            } catch (e: SecurityException) {
              promise.resolve(null)
            }
          }
        }
      }
    }

    /** The folder, only while its persisted read permission still exists; otherwise null. */
    AsyncFunction("getRecordingsFolder") { uri: String ->
      val target = Uri.parse(uri)
      val kept = context.contentResolver.persistedUriPermissions.any { it.uri == target && it.isReadPermission }
      if (kept) mapOf("uri" to uri, "name" to folderName(target)) else null
    }

    /** Audio files in the folder (and one level of sub-folders) modified in [fromMs, toMs], newest first, max 50. */
    AsyncFunction("listRecordings") { treeUri: String, fromMs: Double, toMs: Double ->
      listRecordings(Uri.parse(treeUri), fromMs.toLong(), toMs.toLong())
    }

    /**
     * A recording shared to this app from another app (Share → Compass Dialer; ADR 0010). Copied to
     * the cache the moment it arrives, because the sender's read grant ends with the activity.
     * Resolves the pending file once, then null. Also picks up a share that started the app (cold start).
     */
    AsyncFunction("takeSharedRecording") {
      appContext.currentActivity?.intent?.let { receiveShared(it) }?.let { setPendingShared(it) }
      takePendingShared()
    }.runOnQueue(Queues.DEFAULT)

    /** The app was already running when the file was shared. Copy off the main thread, then tell JS. */
    OnNewIntent { intent ->
      val uri = takeShareUri(intent)
      if (uri != null) {
        val type = intent.type
        Thread {
          val shared = copyShared(uri, type)
          setPendingShared(shared)
          sendEvent("sharedRecording", shared)
        }.start()
      }
    }

    /** PUT the file's bytes to `url`; returns {status}. Non-2xx statuses are returned, IO failures throw. */
    AsyncFunction("uploadRecording") { fileUri: String, url: String, contentType: String, sizeBytes: Double ->
      uploadRecording(Uri.parse(fileUri), url, contentType, sizeBytes.toLong())
    }.runOnQueue(Queues.DEFAULT)
  }

  // ── Permissions ────────────────────────────────────────────────────────────────────────────

  private fun isGranted(permission: String): Boolean =
    try {
      context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
    } catch (e: Exception) {
      false
    }

  // ── Call state ─────────────────────────────────────────────────────────────────────────────

  private fun stateName(state: Int): String = when (state) {
    TelephonyManager.CALL_STATE_OFFHOOK -> "offhook"
    TelephonyManager.CALL_STATE_RINGING -> "ringing"
    else -> "idle"
  }

  private fun emit(state: Int) {
    sendEvent(
      "callState",
      mapOf("state" to stateName(state), "at" to System.currentTimeMillis().toDouble())
    )
  }

  private fun startTracking() {
    if (listener != null) return
    // PhoneStateListener binds to the Looper of the thread that creates it, so register on main.
    main.post {
      if (listener != null) return@post
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          if (!isGranted(Manifest.permission.READ_PHONE_STATE)) return@post
          val cb = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
            override fun onCallStateChanged(state: Int) = emit(state)
          }
          telephony.registerTelephonyCallback(context.mainExecutor, cb)
          listener = cb
        } else {
          @Suppress("DEPRECATION")
          val l = object : PhoneStateListener() {
            @Deprecated("Deprecated in Java")
            override fun onCallStateChanged(state: Int, phoneNumber: String?) = emit(state)
          }
          @Suppress("DEPRECATION")
          telephony.listen(l, PhoneStateListener.LISTEN_CALL_STATE)
          listener = l
        }
      } catch (e: SecurityException) {
        listener = null
      } catch (e: Exceptions.ReactContextLost) {
        listener = null
      }
    }
  }

  private fun stopTracking() {
    val l = listener ?: return
    listener = null
    main.post {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && l is TelephonyCallback) {
          telephony.unregisterTelephonyCallback(l)
        } else if (l is PhoneStateListener) {
          @Suppress("DEPRECATION")
          telephony.listen(l, PhoneStateListener.LISTEN_NONE)
        }
      } catch (e: Exception) {
        // Context already gone; nothing left to unregister.
      }
    }
  }

  /** "idle" | "offhook" | "ringing", or "unknown" when the permission needed to read it is missing. */
  private fun currentState(): String =
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !isGranted(Manifest.permission.READ_PHONE_STATE)) {
        "unknown"
      } else {
        @Suppress("DEPRECATION")
        stateName(telephony.callState)
      }
    } catch (e: SecurityException) {
      "unknown"
    }

  // ── SIMs ───────────────────────────────────────────────────────────────────────────────────

  private fun handleId(h: PhoneAccountHandle) = "${h.componentName.flattenToString()}|${h.id}"

  private fun callHandles(): List<PhoneAccountHandle> =
    if (!isGranted(Manifest.permission.READ_PHONE_STATE)) emptyList()
    else try {
      telecom.callCapablePhoneAccounts ?: emptyList()
    } catch (e: SecurityException) {
      emptyList()
    }

  private fun listSims(): List<Map<String, String>> =
    callHandles().mapIndexed { i, h ->
      val label = try {
        telecom.getPhoneAccount(h)?.label?.toString()
      } catch (e: Exception) {
        null
      }
      mapOf("id" to handleId(h), "label" to (label?.takeIf { it.isNotBlank() } ?: "SIM ${i + 1}"))
    }

  // ── Placing the call ───────────────────────────────────────────────────────────────────────

  /** Returns "direct" when the call was placed, "dialer" when the dialer was opened pre-filled. */
  private fun placeCall(number: String, simId: String?): String {
    val uri = Uri.fromParts("tel", number, null)

    if (isGranted(Manifest.permission.CALL_PHONE)) {
      val extras = Bundle()
      simId?.let { id -> callHandles().firstOrNull { handleId(it) == id } }?.let {
        extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, it)
      }
      try {
        telecom.placeCall(uri, extras)
        return "direct"
      } catch (e: SecurityException) {
        // Permission revoked between the check and the call: fall through to the dialer.
      }
    }

    val intent = Intent(Intent.ACTION_DIAL, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      (appContext.currentActivity ?: context).startActivity(intent)
    } catch (e: ActivityNotFoundException) {
      throw CodedException("E_NO_DIALER", "This phone has no app that can place calls.", null)
    }
    return "dialer"
  }

  // ── Call log ───────────────────────────────────────────────────────────────────────────────

  /**
   * {talkSeconds, startedAt} of the newest outgoing call to `number` since `sinceMs`. Numbers are
   * compared on their last 10 digits ("+91 98765 00001" = "09876500001"). The system writes the
   * entry a moment after the call ends, so the caller retries briefly when this returns null.
   */
  private fun lastCallFromLog(number: String, sinceMs: Double): Map<String, Any>? {
    if (!isGranted(Manifest.permission.READ_CALL_LOG)) return null
    val want = number.filter { it.isDigit() }.takeLast(10)
    if (want.isEmpty()) return null
    return try {
      context.contentResolver.query(
        CallLog.Calls.CONTENT_URI,
        arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.DATE, CallLog.Calls.DURATION),
        "${CallLog.Calls.TYPE} = ? AND ${CallLog.Calls.DATE} >= ?",
        arrayOf(CallLog.Calls.OUTGOING_TYPE.toString(), sinceMs.toLong().toString()),
        "${CallLog.Calls.DATE} DESC",
      )?.use { c ->
        var found: Map<String, Any>? = null
        while (found == null && c.moveToNext()) {
          val n = (c.getString(0) ?: "").filter { it.isDigit() }.takeLast(10)
          if (n == want) {
            found = mapOf("talkSeconds" to c.getLong(2).toDouble(), "startedAt" to c.getLong(1).toDouble())
          }
        }
        found
      }
    } catch (e: SecurityException) {
      null
    }
  }

  // ── Call recordings (read-only folder grant) ───────────────────────────────────────────────

  private fun folderName(treeUri: Uri): String {
    val docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, DocumentsContract.getTreeDocumentId(treeUri))
    val name = try {
      context.contentResolver.query(docUri, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)
        ?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
    } catch (e: Exception) {
      null
    }
    return name ?: (treeUri.lastPathSegment?.substringAfterLast(':') ?: "Folder")
  }

  private fun isAudio(name: String, mime: String?): Boolean =
    (mime?.startsWith("audio/") == true) || name.substringAfterLast('.', "").lowercase() in AUDIO_EXTENSIONS

  private fun listRecordings(treeUri: Uri, fromMs: Long, toMs: Long): List<Map<String, Any>> {
    val out = ArrayList<Map<String, Any>>()
    try {
      collect(treeUri, DocumentsContract.getTreeDocumentId(treeUri), 1, fromMs, toMs, out)
    } catch (e: SecurityException) {
      return emptyList()
    }
    return out.sortedByDescending { it["lastModified"] as Double }.take(MAX_RECORDINGS)
  }

  /** Adds matching files under `parentId`, recursing into sub-folders `depth` more levels. */
  private fun collect(
    treeUri: Uri,
    parentId: String,
    depth: Int,
    fromMs: Long,
    toMs: Long,
    out: MutableList<Map<String, Any>>,
  ) {
    val children = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentId)
    val subDirs = ArrayList<String>()
    val cursor: Cursor = context.contentResolver.query(
      children,
      arrayOf(
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
        DocumentsContract.Document.COLUMN_SIZE,
        DocumentsContract.Document.COLUMN_LAST_MODIFIED,
      ),
      null, null, null,
    ) ?: return
    cursor.use { c ->
      while (c.moveToNext()) {
        val id = c.getString(0) ?: continue
        val name = c.getString(1) ?: ""
        val mime = c.getString(2)
        if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
          if (depth > 0) subDirs.add(id)
          continue
        }
        val modified = if (c.isNull(4)) 0L else c.getLong(4)
        if (!isAudio(name, mime) || modified < fromMs || modified > toMs) continue
        out.add(
          mapOf(
            "uri" to DocumentsContract.buildDocumentUriUsingTree(treeUri, id).toString(),
            "name" to name,
            "sizeBytes" to (if (c.isNull(3)) 0L else c.getLong(3)).toDouble(),
            "lastModified" to modified.toDouble(),
            "mimeType" to (mime ?: ""),
          )
        )
      }
    }
    subDirs.forEach { collect(treeUri, it, depth - 1, fromMs, toMs, out) }
  }

  /** Streams the file to `url` with a fixed-length PUT. Returns the HTTP status; throws only on IO failure. */
  private fun uploadRecording(fileUri: Uri, url: String, contentType: String, sizeBytes: Long): Map<String, Any> {
    var conn: HttpURLConnection? = null
    try {
      conn = URL(url).openConnection() as HttpURLConnection
      conn.requestMethod = "PUT"
      conn.doOutput = true
      conn.connectTimeout = 30_000
      conn.readTimeout = 120_000
      conn.setFixedLengthStreamingMode(sizeBytes)
      conn.setRequestProperty("Content-Type", contentType)
      val input = context.contentResolver.openInputStream(fileUri)
        ?: throw IOException("Can't open the recording file.")
      input.use { ins ->
        conn.outputStream.use { os ->
          val buf = ByteArray(64 * 1024)
          while (true) {
            val n = ins.read(buf)
            if (n < 0) break
            os.write(buf, 0, n)
          }
        }
      }
      val status = conn.responseCode
      try {
        (if (status in 200..299) conn.inputStream else conn.errorStream)?.close()
      } catch (e: IOException) {
        // Body not needed.
      }
      return mapOf("status" to status)
    } catch (e: IOException) {
      throw CodedException("E_UPLOAD_IO", e.message ?: "Upload failed: network error.", e)
    } catch (e: SecurityException) {
      throw CodedException("E_UPLOAD_IO", "No access to the recording file any more.", e)
    } finally {
      conn?.disconnect()
    }
  }

  // ── Recordings shared from another app (Share → Compass Dialer) ───────────────────────────

  private val sharedLock = Any()
  private var pendingShared: Map<String, Any>? = null

  private fun setPendingShared(shared: Map<String, Any>?) {
    if (shared != null) synchronized(sharedLock) { pendingShared = shared }
  }

  private fun takePendingShared(): Map<String, Any>? =
    synchronized(sharedLock) {
      val s = pendingShared
      pendingShared = null
      s
    }

  /**
   * The audio Uri of an ACTION_SEND intent, and marks the intent used (stream removed, neutral
   * action) so it is never handled twice. null for anything else; such intents are left alone.
   */
  @Suppress("DEPRECATION")
  private fun takeShareUri(intent: Intent): Uri? {
    if (intent.action != Intent.ACTION_SEND) return null
    if (intent.type?.startsWith("audio/") != true) return null
    val uri: Uri? =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
      }
    if (uri == null) return null
    intent.removeExtra(Intent.EXTRA_STREAM)
    intent.action = Intent.ACTION_MAIN
    return uri
  }

  /** Synchronous variant for the cold-start path: copy the intent's shared file, if there is one. */
  private fun receiveShared(intent: Intent): Map<String, Any>? {
    val type = intent.type
    val uri = takeShareUri(intent) ?: return null
    return copyShared(uri, type)
  }

  /**
   * Copies the shared file into `cacheDir/shared-recordings` (streamed, 25 MB cap) and describes it:
   * {uri: file://…, name, sizeBytes, mimeType, sharedAt}. When it can't be used the map carries
   * `error` instead: "too_big" or "unreadable" (and uri is ""). Cached copies older than 3 days
   * are deleted first.
   */
  private fun copyShared(source: Uri, intentType: String?): Map<String, Any> {
    val now = System.currentTimeMillis()
    val dir = File(context.cacheDir, "shared-recordings").also { it.mkdirs() }
    dir.listFiles()?.forEach { if (now - it.lastModified() > SHARED_KEEP_MS) it.delete() }

    var name = "recording"
    var declared = -1L
    try {
      context.contentResolver.query(
        source,
        arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
        null, null, null,
      )?.use { c ->
        if (c.moveToFirst()) {
          c.getString(0)?.takeIf { it.isNotBlank() }?.let { name = it }
          if (!c.isNull(1)) declared = c.getLong(1)
        }
      }
    } catch (e: Exception) {
      // The name and size are nice to have; the bytes decide.
    }
    val resolved = try { context.contentResolver.getType(source) } catch (e: Exception) { null }
    val mime = listOf(resolved, intentType).firstOrNull { it != null && it.startsWith("audio/") && !it.endsWith("/*") } ?: ""

    fun result(uri: String, size: Long, error: String? = null): Map<String, Any> {
      val m = mutableMapOf<String, Any>(
        "uri" to uri,
        "name" to name,
        "sizeBytes" to size.toDouble(),
        "mimeType" to mime,
        "sharedAt" to now.toDouble(),
      )
      if (error != null) m["error"] = error
      return m
    }

    if (declared > MAX_SHARED_BYTES) return result("", declared, "too_big")

    val safe = name.replace(Regex("[^A-Za-z0-9._ -]"), "_").take(80)
    val target = File(dir, "$now-$safe")
    try {
      val input = context.contentResolver.openInputStream(source) ?: return result("", 0, "unreadable")
      var total = 0L
      input.use { ins ->
        target.outputStream().use { os ->
          val buf = ByteArray(64 * 1024)
          while (true) {
            val n = ins.read(buf)
            if (n < 0) break
            total += n
            if (total > MAX_SHARED_BYTES) break
            os.write(buf, 0, n)
          }
        }
      }
      if (total > MAX_SHARED_BYTES) {
        target.delete()
        return result("", total, "too_big")
      }
      return result(Uri.fromFile(target).toString(), total)
    } catch (e: IOException) {
      target.delete()
      return result("", 0, "unreadable")
    } catch (e: SecurityException) {
      target.delete()
      return result("", 0, "unreadable")
    }
  }

  companion object {
    private const val MAX_SHARED_BYTES = 26_214_400L
    private const val SHARED_KEEP_MS = 3L * 24 * 60 * 60 * 1000
    private const val PICK_FOLDER_REQUEST = 7311
    private const val MAX_RECORDINGS = 50
    private val AUDIO_EXTENSIONS = setOf("m4a", "aac", "mp3", "wav", "amr", "3gp", "3gpp", "ogg", "opus", "webm")
    private val PERMISSIONS = arrayOf(
      Manifest.permission.CALL_PHONE,
      Manifest.permission.READ_PHONE_STATE,
      Manifest.permission.READ_CALL_LOG,
    )
  }
}
