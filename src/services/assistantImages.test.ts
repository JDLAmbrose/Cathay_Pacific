import { expect, it } from "vitest";
import { assistantHistory, attachImage, prepareAssistantImage, MAX_UPLOAD_BYTES } from "./assistantImages";
import type { Message } from "../types/domain";

it("includes only the latest three photos and marks unavailable earlier ones", () => {
  const messages: Message[] = Array.from({ length: 5 }, (_, i) => ({ role: "user", text: `Photo ${i}` }));
  messages.forEach((message, i) => attachImage(message, { dataUrl: `data:image/png;base64,${i}`, name: `${i}.png` }));
  const history = assistantHistory(messages);
  expect(history.filter((m) => m.images)).toHaveLength(3);
  expect(history[0].content).toContain("Earlier image unavailable");
  expect(history[4].images).toEqual(["data:image/png;base64,4"]);
  expect(JSON.stringify(messages)).not.toContain("data:image");
});

it("rejects unsupported or oversized files before decoding", async () => {
  await expect(prepareAssistantImage(new File(["svg"], "test.svg", { type: "image/svg+xml" }))).rejects.toThrow("agent.imageType");
  await expect(prepareAssistantImage(new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "big.png", { type: "image/png" }))).rejects.toThrow("agent.imageSize");
});
