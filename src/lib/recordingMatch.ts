/**
 * Finding the phone dialer's recording of a call, and checking it can be uploaded (ADR 0007).
 * Pure functions, covered by recordingMatch.test.ts.
 */
import type { RecordingFile } from "@modules/sim-dialer";

/** What the app knows about the call that the recording belongs to. */
export interface CallForMatch {
  /** epoch ms: tap on Call */
  tappedAt: number;
  /** epoch ms: the call ended */
  endedAt: number;
  /** E.164 */
  phone: string;
}

/** Compass accepts these content types only (server-enforced). */
export const ALLOWED_CONTENT_TYPES = [
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/amr",
  "audio/3gpp",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
] as const;

type AllowedType = (typeof ALLOWED_CONTENT_TYPES)[number];

/** 25 MB, the server limit. */
export const MAX_RECORDING_BYTES = 26_214_400;

/** The recording is saved at the end of the call: a little before the tap is allowed (clock skew). */
export const MATCH_BEFORE_MS = 60_000;
/** Dialers finish writing the file shortly after the call ends. */
export const MATCH_AFTER_MS = 10 * 60_000;

const EXTENSION_TYPES: Record<string, AllowedType> = {
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  amr: "audio/amr",
  "3gp": "audio/3gpp",
  "3gpp": "audio/3gpp",
  ogg: "audio/ogg",
  opus: "audio/opus",
  webm: "audio/webm",
};

/** Mime types dialers report that are normalised to one Compass accepts. */
const ALIASES: Record<string, AllowedType> = {
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/mp3": "audio/mpeg",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/x-aac": "audio/aac",
  "audio/x-amr": "audio/amr",
  "audio/amr-wb": "audio/amr",
  "audio/x-ogg": "audio/ogg",
  "video/3gpp": "audio/3gpp",
  "video/mp4": "audio/mp4",
};

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/**
 * The content type to upload with: the file's own mime when Compass accepts it (aliases such as
 * audio/x-m4a are normalised to audio/mp4), else from the extension. null when it is neither.
 */
export function recordingContentType(file: Pick<RecordingFile, "name" | "mimeType">): string | null {
  const mime = (file.mimeType ?? "").toLowerCase().split(";")[0]!.trim();
  const alias = ALIASES[mime];
  if (alias) return alias;
  if ((ALLOWED_CONTENT_TYPES as readonly string[]).includes(mime)) return mime;
  return EXTENSION_TYPES[extensionOf(file.name)] ?? null;
}

/** null when the file can be uploaded, else the reason, in words for the agent. */
export function recordingProblem(
  file: Pick<RecordingFile, "name" | "mimeType" | "sizeBytes">,
): string | null {
  if (!recordingContentType(file)) return "This isn't a supported audio file.";
  if (file.sizeBytes <= 0) return "This recording is empty.";
  if (file.sizeBytes > MAX_RECORDING_BYTES) return "This recording is over 25 MB, too large to upload.";
  return null;
}

/** Candidate window: from a minute before the tap to ten minutes after the call ended. */
export function recordingWindow(call: Pick<CallForMatch, "tappedAt" | "endedAt">): {
  from: number;
  to: number;
} {
  return { from: call.tappedAt - MATCH_BEFORE_MS, to: call.endedAt + MATCH_AFTER_MS };
}

/** Does the file name contain at least 7 trailing digits of the number? ("…_9876500001_…") */
function nameHasNumber(name: string, phone: string): boolean {
  const number = phone.replace(/\D/g, "").slice(-10);
  if (number.length < 7) return false;
  const digits = name.replace(/\D/g, "");
  return digits.includes(number.slice(-7));
}

export interface RecordingMatch {
  best: RecordingFile | null;
  /** Every file in the window, best first. */
  candidates: RecordingFile[];
}

/**
 * Pick the recording of `call` from `files`: inside the candidate window, files whose name contains
 * the number win, then the one modified closest to when the call ended. Files that can't be
 * uploaded (wrong type, too big) are never `best`, but still appear in `candidates`.
 */
export function matchRecording(call: CallForMatch, files: RecordingFile[]): RecordingMatch {
  const { from, to } = recordingWindow(call);
  const candidates = files
    .filter((f) => f.lastModified >= from && f.lastModified <= to)
    .map((f) => ({
      f,
      named: nameHasNumber(f.name, call.phone),
      gap: Math.abs(f.lastModified - call.endedAt),
    }))
    .sort((a, b) => Number(b.named) - Number(a.named) || a.gap - b.gap)
    .map((x) => x.f);
  return { best: candidates.find((f) => recordingProblem(f) === null) ?? null, candidates };
}
