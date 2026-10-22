/**
 * Shared types for the image -> text (OCR) flow.
 *
 * These are used by both the API routes (`app/api/ocr/**`) and the client
 * components (`components/ocr/**`) so the two sides can never drift apart.
 */

/** A stored image of a job. */
export type OcrImage = {
  key: string;
  /** Browser reachable url of the stored image (`/api/files/...`). */
  url: string;
  name: string;
};

/** Per image transcription outcome. */
export type OcrImageResult = {
  imageKey: string;
  status: "pending" | "processing" | "done" | "error";
  /** The raw extraction, exactly as the model returned it. */
  text?: string;
  /** Structured blocks of the raw extraction. */
  blocks?: unknown;
  /** The writer's corrected text (only set after an explicit approval). */
  editedText?: string;
  /** 0..1 confidence, when the provider reports one. */
  confidence?: number;
  error?: string;
};

export type OcrJobStatus = "pending" | "running" | "review" | "done" | "failed";

/** A job as seen by the client. */
export type OcrJobView = {
  id: string;
  status: OcrJobStatus;
  provider: string | null;
  model: string | null;
  language: string;
  storyId: string | null;
  chapterId: string | null;
  images: OcrImage[];
  results: OcrImageResult[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A presigned upload target. */
export type OcrUpload = {
  key: string;
  name: string;
  /** Presigned PUT url — the client sends the bytes straight to storage. */
  url: string;
};

export type CreateOcrJobInput = {
  storyId?: string | null;
  chapterId?: string | null;
  language?: string | null;
  images: { name: string; contentType: string }[];
};

export type CreateOcrJobResponse = {
  jobId: string;
  uploads: OcrUpload[];
};

export type RepairResponse = {
  text: string;
  blocks: unknown;
  notes: string[];
};

/** A story the writer may add chapters to, with its chapters. */
export type OcrTarget = {
  id: string;
  title: string;
  chapters: { id: string; title: string }[];
};
