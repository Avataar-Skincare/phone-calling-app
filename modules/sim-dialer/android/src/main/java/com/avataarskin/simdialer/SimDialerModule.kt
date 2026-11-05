package com.avataarskin.simdialer

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

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
 * the other side answered, and OFFHOOK starts while the outgoing call is still ringing.
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

  override fun definition() = ModuleDefinition {
    Name("SimDialer")

    Events("callState")

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

  companion object {
    private val PERMISSIONS = arrayOf(
      Manifest.permission.CALL_PHONE,
      Manifest.permission.READ_PHONE_STATE,
    )
  }
}
