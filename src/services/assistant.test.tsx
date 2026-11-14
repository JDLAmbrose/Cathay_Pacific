import { QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  agentRuntime,
  clearAgentConversation,
  draft,
  initial,
  restoreBooking,
  sendQuestion,
  state,
} from "../engine/booking";
import { AssistantPage } from "../pages/assistant";
import type { AssistantInput, AssistantReply, AssistantProgress } from "../types/domain";
import { browserDataSource, setDataSource } from "./dataSource";
import { queryClient } from "./query";

beforeEach(() => {
  restoreBooking(initial());
  clearAgentConversation(false);
});
afterEach(() => {
  queryClient.clear();
  setDataSource(browserDataSource);
});

it("sends only the allowlisted context, preserves turns, and escapes assistant text", async () => {
  const askAssistant = vi.fn(async (_input: AssistantInput) => ({
    reply: "Demo quote <script>alert(1)</script>",
    tools: ["get_price_context"],
  }));
  setDataSource({ ...browserDataSource, askAssistant });
  state.phone = "PRIVATE_PHONE";
  state.pickupAddress = "PRIVATE_ADDRESS";
  state.destinationAddress = "PRIVATE_DESTINATION";
  await sendQuestion("Compare the costs");
  await sendQuestion("What about the deadline?");
  const [payload] = askAssistant.mock.calls[0];
  expect(payload.context).toMatchObject({
    pricing: { current: { total: 2400 }, allCargo: { total: 1950 } },
  });
  expect(JSON.stringify(payload)).not.toMatch(/PRIVATE_/);
  expect(
    askAssistant.mock.calls[1][0].messages.map((message) => message.role),
  ).toEqual(["user", "assistant", "user"]);
  const html = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <AssistantPage />
    </QueryClientProvider>,
  );
  expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(html).not.toContain("<script>");
  expect(state.orders).toHaveLength(0);
});

it("reports failures and retries without duplicating the user message", async () => {
  const askAssistant = vi
    .fn()
    .mockRejectedValueOnce(new Error("provider_quota"))
    .mockResolvedValueOnce({ reply: "Recovered", tools: [] });
  setDataSource({ ...browserDataSource, askAssistant });
  await sendQuestion("Hello");
  expect(agentRuntime.error).toBe("agent.quota");
  await sendQuestion("Hello", true);
  expect(state.agent.messages.map((message) => message.role)).toEqual([
    "user",
    "assistant",
  ]);
  expect(agentRuntime.error).toBeNull();
});

it("discards a stale answer if booking context changes while waiting", async () => {
  let resolve: (reply: AssistantReply) => void;
  const promise = new Promise<AssistantReply>((done) => {
    resolve = done;
  });
  setDataSource({ ...browserDataSource, askAssistant: () => promise });
  const pending = sendQuestion("What is my price?");
  await sendQuestion("Duplicate click");
  expect(state.agent.messages).toHaveLength(1);
  draft().items[0].weight = 21;
  resolve({ reply: "Stale answer", tools: [] });
  await pending;
  expect(agentRuntime.error).toBe("agent.contextChanged");
  expect(state.agent.messages).toHaveLength(1);
});

it("does not call the assistant provider in local mode", async () => {
  const askAssistant = vi.fn();
  setDataSource({ ...browserDataSource, askAssistant });
  state.agent.mode = "local";
  await sendQuestion("power bank 74 Wh");
  expect(askAssistant).not.toHaveBeenCalled();
  expect(state.agent.answer).toMatchObject({ category: "battery" });
});


it("sends image-only turns and retains photos on retry without persisting bytes", async () => {
  const image = { dataUrl: "data:image/jpeg;base64,/9j/2Q==", name: "item.jpg" };
  const saveBooking = vi.fn();
  const askAssistant = vi.fn().mockRejectedValueOnce(new Error("provider_rate_limit"))
    .mockResolvedValue({ reply: "Cannot yet confirm", tools: [] });
  setDataSource({ ...browserDataSource, askAssistant, saveBooking });
  agentRuntime.image = image;
  await sendQuestion("");
  expect(askAssistant.mock.calls[0][0].messages[0].images).toEqual([image.dataUrl]);
  expect(askAssistant.mock.calls[0][0].messages[0].content.length).toBeGreaterThan(0);
  expect(agentRuntime.image).toBeNull();
  expect(JSON.stringify(saveBooking.mock.calls)).not.toContain("data:image");
  const question = state.agent.messages[0].text;
  await sendQuestion(question, true);
  expect(askAssistant.mock.calls[1][0].messages[0].images).toEqual([image.dataUrl]);
  expect(state.agent.messages).toHaveLength(2);
  await sendQuestion("What else?");
  expect(askAssistant.mock.calls[2][0].messages[0].images).toEqual([image.dataUrl]);
  const restored = JSON.parse(JSON.stringify(state));
  restoreBooking(restored);
  await sendQuestion("Check it again");
  expect(askAssistant.mock.calls[3][0].messages[0].images).toBeUndefined();
  expect(askAssistant.mock.calls[3][0].messages[0].content).toContain("Earlier image unavailable");
});

it("clears a pending image with a new conversation", () => {
  agentRuntime.image = { dataUrl: "data:image/jpeg;base64,/9j/2Q==", name: "item.jpg" };
  clearAgentConversation(false);
  expect(agentRuntime.image).toBeNull();
});

it("refreshes image trip context and distinguishes total, service, unknown and zero bags", async () => {
  const askAssistant = vi.fn(async (_input: AssistantInput) => ({ reply: "Demo trip", tools: [] }));
  setDataSource({ ...browserDataSource, askAssistant });
  agentRuntime.image = { dataUrl: "data:image/jpeg;base64,/9j/2Q==", name: "item.jpg" };
  await sendQuestion("");
  expect(askAssistant.mock.calls[0][0].context).toMatchObject({
    trip: { flight: { destination: state.flight.destination } },
    baggage: { totalCount: draft().items.length, serviceCount: draft().items.filter((i) => i.mode === "checked" && i.service).length },
    pricing: { current: { valid: true, total: 2400 } },
  });
  state.agent.route = "AU";
  draft().countUnknown = true;
  await sendQuestion("What about this trip?");
  expect(askAssistant.mock.calls[1][0].context).toMatchObject({
    trip: { enquiryDestination: "AU" },
    baggage: { totalCount: null, serviceCount: null, items: [] },
  });
  draft().countUnknown = false;
  draft().zero = true;
  await sendQuestion("No bags now");
  expect(askAssistant.mock.calls[2][0].context).toMatchObject({
    baggage: { totalCount: 0, serviceCount: 0, items: [] },
  });
});

it("shows saved customs tool attribution and all new destinations", async () => {
  setDataSource({ ...browserDataSource, askAssistant: async () => ({reply: "Saved policy", tools: ["get_customs_policy"]}) });
  await sendQuestion("Japan customs rules");
  expect(state.agent.messages.at(-1)?.tools).toEqual(["get_customs_policy"]);
  const html = renderToStaticMarkup(<QueryClientProvider client={queryClient}><AssistantPage /></QueryClientProvider>);
  for (const code of ["CN", "JP", "HK"]) expect(html).toContain(`value="${code}"`);
  expect(html).toContain("已存海關政策");
});

it("renders thinking and escaped live text but persists only the completed reply", async () => {
  let progress: (event: AssistantProgress) => void;
  let resolve: (reply: AssistantReply) => void;
  const result = new Promise<AssistantReply>((done) => { resolve = done; });
  const saveBooking = vi.fn();
  setDataSource({ ...browserDataSource, saveBooking,
    askAssistant: (_input, _signal, onProgress) => { progress = onProgress; return result; } });
  const pending = sendQuestion("Hello");
  await vi.waitFor(() => expect(progress).toBeTypeOf("function"));
  const markup = () => renderToStaticMarkup(<QueryClientProvider client={queryClient}><AssistantPage /></QueryClientProvider>);
  expect(markup()).toContain("agent-thinking-dots");
  progress({ type: "delta", text: "Partial <script>" });
  expect(markup()).toContain("Partial &lt;script&gt;");
  expect(agentRuntime.pending).toBe(true);
  expect(state.agent.messages).toHaveLength(1);
  expect(JSON.stringify(saveBooking.mock.calls)).not.toContain("Partial");
  progress({ type: "reset" });
  expect(agentRuntime.streamText).toBe("");
  progress({ type: "status", stage: "tool", tool: "get_customs_policy" });
  expect(markup()).toContain("已存海關政策");
  resolve({ reply: "Complete", tools: [] });
  await pending;
  expect(state.agent.messages.at(-1)?.text).toBe("Complete");
  expect(agentRuntime.streamText).toBe("");
  expect(agentRuntime.progress).toBeNull();
  expect(markup()).not.toContain("agent-thinking-dots");
});

it("discards streaming fragments and a late final result after cancellation or clear", async () => {
  for (const clear of [false, true]) {
    clearAgentConversation(false);
    let progress: (event: AssistantProgress) => void;
    let resolve: (reply: AssistantReply) => void;
    const result = new Promise<AssistantReply>((done) => { resolve = done; });
    setDataSource({ ...browserDataSource,
      askAssistant: (_input, _signal, onProgress) => { progress = onProgress; return result; } });
    const pending = sendQuestion("Hello");
    await vi.waitFor(() => expect(progress).toBeTypeOf("function"));
    progress({ type: "delta", text: "Early text" });
    if (clear) clearAgentConversation(false);
    else agentRuntime.controller.abort();
    progress({ type: "delta", text: "Late fragment" });
    expect(agentRuntime.streamText).not.toContain("Late");
    resolve({ reply: "Late complete answer" });
    await pending;
    expect(state.agent.messages.every((message) => message.role === "user")).toBe(true);
    expect(agentRuntime.streamText).toBe("");
    expect(agentRuntime.pending).toBe(false);
  }
});

it("rejects live progress when the linked trip changes", async () => {
  let progress: (event: AssistantProgress) => void;
  let reject: (error: Error) => void;
  const result = new Promise<AssistantReply>((_resolve, fail) => { reject = fail; });
  setDataSource({ ...browserDataSource,
    askAssistant: (_input, _signal, onProgress) => { progress = onProgress; return result; } });
  const pending = sendQuestion("What is my price?");
  await vi.waitFor(() => expect(progress).toBeTypeOf("function"));
  draft().items[0].weight = 28;
  try { progress({ type: "delta", text: "Old price" }); }
  catch (error) { reject(error as Error); }
  await pending;
  expect(agentRuntime.error).toBe("agent.contextChanged");
  expect(state.agent.messages).toHaveLength(1);
  expect(agentRuntime.streamText).toBe("");
});
