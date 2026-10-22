import type {
  CommentCounts,
  CommentDto,
  CommentsResponse,
  CommentSession,
  CreateCommentInput,
} from "./types";

export class CommentsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CommentsApiError";
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new CommentsApiError("Network error. Check your connection.", 0);
  }

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed (${response.status})`;
    throw new CommentsApiError(message, response.status);
  }

  return data as T;
}

export type ListCommentsQuery = {
  storyId: string;
  scope?: "story" | "chapter" | "inline";
  chapterId?: string | null;
  blockId?: string | null;
  limit?: number;
  offset?: number;
};

export function fetchComments(query: ListCommentsQuery): Promise<CommentsResponse> {
  const params = new URLSearchParams();
  params.set("storyId", query.storyId);
  if (query.scope) params.set("scope", query.scope);
  if (query.chapterId) params.set("chapterId", query.chapterId);
  if (query.blockId) params.set("blockId", query.blockId);
  if (typeof query.limit === "number") params.set("limit", String(query.limit));
  if (typeof query.offset === "number") params.set("offset", String(query.offset));
  return request<CommentsResponse>(`/api/comments?${params.toString()}`);
}

export function createComment(input: CreateCommentInput): Promise<{ comment: CommentDto }> {
  return request<{ comment: CommentDto }>("/api/comments", {
    method: "POST",
    body: JSON.stringify({
      storyId: input.storyId,
      chapterId: input.chapterId ?? null,
      blockId: input.blockId ?? null,
      quotedText: input.quotedText ?? null,
      parentId: input.parentId ?? null,
      body: input.body,
    }),
  });
}

export function deleteComment(id: string): Promise<{ ok: boolean; id: string; deletedAt: string }> {
  return request<{ ok: boolean; id: string; deletedAt: string }>(`/api/comments/${id}`, {
    method: "DELETE",
  });
}

export function reportComment(id: string, reason?: string): Promise<{ ok: boolean; id: string }> {
  return request<{ ok: boolean; id: string }>(`/api/comments/${id}/report`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? "" }),
  });
}

export function fetchCommentCounts(storyId: string): Promise<CommentCounts> {
  const params = new URLSearchParams();
  params.set("storyId", storyId);
  return request<CommentCounts>(`/api/comments/counts?${params.toString()}`);
}

export function fetchCommentSession(): Promise<CommentSession> {
  return request<CommentSession>("/api/comments/session");
}
