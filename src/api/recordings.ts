import { api } from "./client";

/** POST /mobile-dialer/recordings/:activityId/upload-url (ADR 0007). */
export interface UploadUrlResponse {
  upload_url: string;
  method: "PUT";
  /** Send exactly these on the PUT (they are part of the S3 signature). */
  headers: { "Content-Type": string };
  key: string;
  expires_at: string;
}

export interface CompleteUploadResponse {
  recording_url: string;
  size_bytes: number;
}

/** Ask Compass for a 10-minute link to PUT the recording to S3. */
export function requestRecordingUpload(activityId: string, contentType: string, sizeBytes: number) {
  return api.post<UploadUrlResponse>(
    `/mobile-dialer/recordings/${encodeURIComponent(activityId)}/upload-url`,
    {
      content_type: contentType,
      size_bytes: sizeBytes,
    },
  );
}

/** Tell Compass the file is in S3; it saves `recording_url` on the activity. */
export function completeRecordingUpload(activityId: string, key: string) {
  return api.post<CompleteUploadResponse>(
    `/mobile-dialer/recordings/${encodeURIComponent(activityId)}/complete`,
    {
      key,
    },
  );
}
