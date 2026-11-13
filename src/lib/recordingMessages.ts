/**
 * Plain-English text for recording upload errors. The stored error can come from our own code,
 * from storage (S3) or from Compass. Pure function, covered by recordingMessages.test.ts.
 */
export function recordingErrorMessage(error: string | null | undefined): string {
  const e = (error ?? "").trim();
  if (!e) return "Upload did not finish. Try again.";
  const text = e.toLowerCase();

  if (text.includes("refused by storage") || text.includes("403") || text.includes("forbidden")) {
    return "Upload was refused. Please tell your team lead.";
  }
  if (text.includes("not in compass yet")) {
    return "This call is not in Compass yet. Wait a moment and try again.";
  }
  if (text.includes("not your") || text.includes("owner") || text.includes("agent")) {
    return "This is not your call.";
  }
  if (
    text.includes("too old") ||
    text.includes("older") ||
    text.includes("expired") ||
    text.includes("window") ||
    // Compass TOO_OLD: "Recordings can be added up to 7 days after the call"
    text.includes("days after the call")
  ) {
    return "This call is too old to upload a recording.";
  }
  if (
    text.includes("over 25 mb") ||
    text.includes("too large") ||
    text.includes("too big") ||
    // Compass BAD_SIZE: "Recordings must be between 1 byte and 25 MB"
    text.includes("must be between")
  ) {
    return "This recording is too big. The limit is 25 MB.";
  }
  if (text.includes("empty")) return "This recording is empty.";
  if (
    text.includes("supported audio") ||
    text.includes("content type") ||
    // Compass UNSUPPORTED_TYPE: "\"image/png\" isn't an audio type Compass accepts"
    text.includes("audio type")
  ) {
    return "This file is not a supported audio file.";
  }
  // Compass NOT_AN_APP_CALL: "Recordings can only be added to calls made from the app"
  if (text.includes("made from the app")) {
    return "Recordings can only be added to calls made from this app.";
  }
  // Compass NOT_UPLOADED: "The file hasn't reached Compass yet. Upload it again."
  if (text.includes("reached compass")) return "Upload did not finish. Try again.";
  if (
    text.includes("network") ||
    text.includes("connection") ||
    text.includes("internet") ||
    text.includes("timed out") ||
    text.includes("timeout") ||
    text.includes("failed to fetch") ||
    text.startsWith("upload failed")
  ) {
    return "No internet. Try again.";
  }
  if (text.includes("not found") || text.includes("404")) {
    return "This call is not in Compass yet. Try again later.";
  }
  return "Could not upload. Try again.";
}
