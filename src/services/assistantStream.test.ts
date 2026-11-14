import { afterEach, expect, it, vi } from "vitest";
import { browserDataSource } from "./dataSource";
import { readAssistantStream } from "./assistantStream";

const encode = new TextEncoder();
const frame = (data: object) => `data: ${JSON.stringify(data)}\r\n\r\n`;
afterEach(() => vi.unstubAllGlobals());

it("delivers incremental UTF-8 events before the final result arrives", async () => {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
  const events = vi.fn();
  const promise = readAssistantStream(new Response(stream), events);
  const bytes = encode.encode(': ping\r\n\r\n' + frame({ type: "delta", text: "你好。" }));
  for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
  await vi.waitFor(() => expect(events).toHaveBeenCalledWith({ type: "delta", text: "你好。" }));
  controller.enqueue(encode.encode(frame({ type: "reset" }) + frame({ type: "status", stage: "tool", tool: "get_customs_policy" })));
  controller.enqueue(encode.encode(frame({ type: "done", result: { reply: "Final", tools: ["get_customs_policy"] } })));
  expect(await promise).toEqual({ reply: "Final", tools: ["get_customs_policy"] });
  expect(events).toHaveBeenCalledWith({ type: "reset" });
});

it("rejects interrupted, invalid and error streams instead of accepting partial text", async () => {
  for (const [body, error] of [
    [frame({ type: "delta", text: "Partial" }), "incomplete_response"],
    [frame({ type: "error", error: "provider_quota" }), "provider_quota"],
    [frame({ type: "done", result: { reply: "" } }), "invalid_response"],
    [frame({ type: "delta", text: "x".repeat(12001) }), "invalid_response"],
  ]) await expect(readAssistantStream(new Response(body), () => {})).rejects.toThrow(error);
});

it("cancels the body reader on abort and never resolves a partial answer", async () => {
  const controller = new AbortController();
  const cancel = vi.fn();
  const promise = readAssistantStream(new Response(new ReadableStream({ cancel })), () => {}, controller.signal);
  controller.abort();
  await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  expect(cancel).toHaveBeenCalled();
});

it("requests SSE only when progress is supported and preserves HTTP errors", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(frame({ type: "done", result: { reply: "Streaming" } }),
    { headers: { "Content-Type": "text/event-stream" } }))
    .mockResolvedValueOnce(Response.json({ error: "rate_limit" }, { status: 429 }))
    .mockResolvedValueOnce(Response.json({ reply: "JSON" }));
  vi.stubGlobal("fetch", fetcher);
  const input = { messages: [], context: {}, language: "en" as const };
  expect(await browserDataSource.askAssistant(input, undefined, () => {})).toEqual({ reply: "Streaming" });
  expect(fetcher.mock.calls[0][1].headers.Accept).toBe("text/event-stream");
  await expect(browserDataSource.askAssistant(input, undefined, () => {})).rejects.toThrow("rate_limit");
  expect(await browserDataSource.askAssistant(input)).toEqual({ reply: "JSON" });
});
