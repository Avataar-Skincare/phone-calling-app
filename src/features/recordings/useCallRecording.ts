import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

import * as SimDialer from "@modules/sim-dialer";
import type { RecordingFile } from "@modules/sim-dialer";
import { matchRecording, recordingWindow } from "@/lib/recordingMatch";
import { useCallLog, type FinishedCall } from "@/store/callLog.store";
import { useSettingsStore } from "@/store/settings.store";
import { isUploadInFlight, uploadRecording } from "./uploadRecording";

/** The dialer saves the file a moment after the call: look again a few times before giving up. */
const RESCAN_EVERY_MS = 5_000;
const RESCAN_TIMES = 6;
/** "Choose file" lists audio from the last two hours. */
const PICK_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Whether recording upload applies to a call: Android calls where someone answered. */
export function canUploadRecording(call: FinishedCall): boolean {
  return Platform.OS === "android" && SimDialer.isNativeDialerAvailable && call.answered !== false;
}

export type RecordingPhase =
  "uploaded" | "uploading" | "failed" | "no_folder" | "looking" | "found" | "not_found";

/**
 * Everything about one call's recording, shared by the summary card row and the Upload call
 * recording screen: scan the folder (and rescan), the best match, the picker list, and the
 * upload state kept on the call.
 */
export function useCallRecording(callId: string) {
  const call = useCallLog((s) => s.calls.find((c) => c.id === callId));
  const folder = useSettingsStore((s) => s.recordingsFolder);
  const setRecordingsFolder = useSettingsStore((s) => s.setRecordingsFolder);
  const [files, setFiles] = useState<RecordingFile[] | null>(null);
  const [scanning, setScanning] = useState(true);
  const [scanToken, setScanToken] = useState(0);
  const [pickable, setPickable] = useState<RecordingFile[]>([]);
  const [picking, setPicking] = useState(false);

  const recording = call?.recording;
  const done = recording?.status === "uploaded";
  const folderUri = folder?.uri;
  const tappedAt = call?.tappedAt;
  const endedAt = call?.endedAt;
  const phone = call?.phone;

  // Look for the file, again every few seconds until found (it is written just after the call).
  useEffect(() => {
    if (!folderUri || done || tappedAt === undefined || endedAt === undefined || phone === undefined) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let round = 0;
    const scan = async () => {
      const { from, to } = recordingWindow({ tappedAt, endedAt });
      const found = await SimDialer.listRecordings(folderUri, from, to).catch(() => []);
      if (cancelled) return;
      setFiles(found);
      const { best } = matchRecording({ tappedAt, endedAt, phone }, found);
      if (!best && ++round < RESCAN_TIMES) {
        timer = setTimeout(() => void scan(), RESCAN_EVERY_MS);
      } else {
        setScanning(false);
      }
    };
    void scan();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [folderUri, done, tappedAt, endedAt, phone, scanToken]);

  const best =
    files && tappedAt !== undefined && endedAt !== undefined && phone !== undefined
      ? matchRecording({ tappedAt, endedAt, phone }, files).best
      : null;

  const openPicker = useCallback(async () => {
    if (!folderUri) return;
    const now = Date.now();
    setPickable(await SimDialer.listRecordings(folderUri, now - PICK_WINDOW_MS, now).catch(() => []));
    setPicking(true);
  }, [folderUri]);

  const upload = useCallback((file: RecordingFile) => uploadRecording(callId, file), [callId]);

  /** Ask the phone for the recordings folder (read-only grant) and remember it. */
  const chooseFolder = useCallback(async () => {
    const picked = await SimDialer.pickRecordingsFolder().catch(() => null);
    if (picked) setRecordingsFolder({ uri: picked.uri, name: picked.name });
    return picked;
  }, [setRecordingsFolder]);

  /** Start the scan again (the dialer may have saved the file late). */
  const lookAgain = useCallback(() => {
    setFiles(null);
    setScanning(true);
    setScanToken((n) => n + 1);
  }, []);

  // The file of a failed or cut-short upload, so Retry doesn't need a new scan.
  const retryFile: RecordingFile | null = recording
    ? {
        uri: recording.fileUri,
        name: recording.fileName,
        sizeBytes: recording.sizeBytes,
        lastModified: 0,
        mimeType: recording.contentType,
      }
    : null;

  let phase: RecordingPhase;
  if (recording?.status === "uploaded") phase = "uploaded";
  else if (recording?.status === "uploading" && isUploadInFlight(callId)) phase = "uploading";
  else if (recording) phase = "failed";
  else if (!folder) phase = "no_folder";
  else if (best) phase = "found";
  else if (files === null || scanning) phase = "looking";
  else phase = "not_found";

  const error =
    recording && phase === "failed"
      ? recording.status === "failed" && recording.error
        ? recording.error
        : "Upload didn't finish."
      : null;

  return {
    call,
    phase,
    folder,
    files,
    best,
    error,
    retryFile,
    pickable,
    picking,
    setPicking,
    openPicker,
    upload,
    chooseFolder,
    lookAgain,
  };
}
