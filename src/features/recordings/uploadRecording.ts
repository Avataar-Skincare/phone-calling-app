import type { RecordingFile } from "@modules/sim-dialer";
import * as SimDialer from "@modules/sim-dialer";

import { completeRecordingUpload, requestRecordingUpload } from "@/api/recordings";
import { recordingContentType, recordingProblem } from "@/lib/recordingMatch";
import { useCallLog, type CallRecording } from "@/store/callLog.store";

/** Calls with an upload running right now. A second tap on the same call is ignored. */
const inFlight = new Set<string>();

/** True while this session is uploading the call's recording (a stored "uploading" with no upload is stale). */
export function isUploadInFlight(callId: string): boolean {
  return inFlight.has(callId);
}

function setRecording(callId: string, recording: CallRecording) {
  useCallLog.getState().update(callId, { recording });
}

/**
 * Upload the phone dialer's recording of a call to Compass (ADR 0007), in three steps:
 * ask Compass for an upload link, PUT the file to S3 from the phone, tell Compass it is there.
 * The outcome is stored on the call (`recording`); this never throws. Retry by calling it again.
 */
export async function uploadRecording(callId: string, file: RecordingFile): Promise<void> {
  if (inFlight.has(callId)) return;
  const call = useCallLog.getState().calls.find((c) => c.id === callId);
  if (!call) return;

  const contentType = recordingContentType(file);
  const base = {
    fileUri: file.uri,
    fileName: file.name,
    sizeBytes: file.sizeBytes,
    contentType: contentType ?? "",
    uploadedAt: null,
  };
  const fail = (error: string) => setRecording(callId, { ...base, status: "failed", error });

  const problem = recordingProblem(file);
  if (problem || !contentType) return fail(problem ?? "This isn't a supported audio file.");

  const activityId = call.activityId;
  if (!activityId) return fail("Call not in Compass yet — try again in a moment");

  inFlight.add(callId);
  setRecording(callId, { ...base, status: "uploading", error: null });
  try {
    const link = await requestRecordingUpload(activityId, contentType, file.sizeBytes);

    let status: number;
    try {
      // Content-Type must be exactly what Compass signed, so the one it returned is the one sent.
      ({ status } = await SimDialer.uploadRecording(
        file.uri,
        link.upload_url,
        link.headers["Content-Type"],
        file.sizeBytes,
      ));
    } catch (e) {
      return fail(
        e instanceof Error && e.message
          ? `Upload failed: ${e.message}`
          : "Upload failed. Check your connection.",
      );
    }
    if (status < 200 || status >= 300) {
      return fail(
        status === 403 ? "Upload refused by storage (403)" : `Upload refused by storage (${status})`,
      );
    }

    await completeRecordingUpload(activityId, link.key);
    setRecording(callId, { ...base, status: "uploaded", error: null, uploadedAt: Date.now() });
  } catch (e) {
    fail(e instanceof Error && e.message ? e.message : "Couldn't upload the recording.");
  } finally {
    inFlight.delete(callId);
  }
}
