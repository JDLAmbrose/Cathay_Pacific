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
import type { AssistantInput, AssistantReply } from "../types/domain";
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
    .mockRejectedValueOnce(new Error("provider_subscription_expired"))
    .mockResolvedValueOnce({ reply: "Recovered", tools: [] });
  setDataSource({ ...browserDataSource, askAssistant });
  await sendQuestion("Hello");
  expect(agentRuntime.error).toBe("agent.expired");
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
