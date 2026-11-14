import type { AssistantProgress, AssistantReply } from "../types/domain";

export function validateAssistantReply(value: unknown): AssistantReply {
  const data = value as AssistantReply;
  if (typeof data?.reply !== "string" || !data.reply.trim() || data.reply.length > 12000)
    throw new Error("invalid_response");
  return data;
}

/** POST SSE: preserve UTF-8 across packets and require an explicit terminal event. */
export async function readAssistantStream(
  response: Response,
  onProgress: (event: AssistantProgress) => void,
  signal?: AbortSignal,
): Promise<AssistantReply> {
  if (!response.body) throw new Error("incomplete_response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "", total = 0, draftLength = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) throw new Error("incomplete_response");
      total += value.byteLength;
      if (total > 1_048_576) throw new Error("invalid_response");
      buffer += decoder.decode(value, { stream: true });
      // Split only complete frames; CRLF can itself span network packets.
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, "")).join("\n");
        if (!data) continue; // Heartbeat/comments.
        const event = JSON.parse(data);
        if (event?.type === "error")
          throw new Error(typeof event.error === "string" ? event.error : "provider_unavailable");
        if (event?.type === "done") return validateAssistantReply(event.result);
        if (event?.type === "reset") {
          draftLength = 0;
          onProgress({ type: "reset" });
        } else if (event?.type === "delta" && typeof event.text === "string") {
          draftLength += event.text.length;
          if (draftLength > 12000) throw new Error("invalid_response");
          onProgress({ type: "delta", text: event.text });
        } else if (event?.type === "status" && ["thinking", "reading_image", "checking", "tool"].includes(event.stage)) {
          onProgress({ type: "status", stage: event.stage, tool: typeof event.tool === "string" ? event.tool : undefined });
        } else throw new Error("invalid_response");
      }
      if (buffer.length > 131072) throw new Error("invalid_response");
    }
  } finally {
    signal?.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
