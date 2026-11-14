import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AssistantReplyContent } from "./AssistantReply";

it("places a bold verdict before separate rule, source and action callouts", () => {
  const text = "## ❌ 不可以入境 — 測試地區\n\n> [!IMPORTANT] 規定與適用條件\n> **必要條件** 尚未滿足。\n> 第二行。\n\n> [!NOTE] 官方來源\n> [海關官方頁面](https://www.customs.go.jp/english/summary/passenger.htm)\n> 核查：2026-11-14。\n\n> [!TIP] 下一步\n> 請確認內容物。";
  const html = renderToStaticMarkup(<AssistantReplyContent text={text} />);
  expect(html).toContain("agent-verdict-no");
  expect(html).toContain("<strong>不可以入境 — 測試地區</strong>");
  expect(html.indexOf("<h3")).toBeLessThan(html.indexOf("<aside"));
  expect(html.match(/<aside/g)).toHaveLength(3);
  expect(html).toContain('<strong>必要條件</strong>');
  expect(html).toContain('href="https://www.customs.go.jp/english/summary/passenger.htm"');
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).not.toContain("[!NOTE]");
  expect(html).not.toContain("##");
});

it("keeps yes, no and unknown distinct across languages, including a partial stream", () => {
  for (const [text, variant] of [["## ✅ Yes — subject to conditions", "yes"], ["## ❌ No — restricted", "no"], ["## ⚠️ 暫無法確認 — 缺少成分", "unknown"], ["## ⚠️ لا يمكن التأكيد — يلزم التحقق", "unknown"]]) {
    const html = renderToStaticMarkup(<AssistantReplyContent text={text + "\n\n> [!NOTE] Source\n> [Customs](https://www.customs.go.jp"} streaming />);
    expect(html).toContain(`agent-verdict-${variant}`);
    expect(html).toContain("agent-cursor");
    expect(html).not.toContain('<a '); // An incomplete URL is not navigable.
  }
});

it("escapes HTML and refuses script, data, relative and credential-bearing links", () => {
  const text = "## ⚠️ 暫無法確認\n\n> [!WARNING] <img src=x onerror=alert(1)>\n> <script>alert(1)</script>\n> [bad](javascript:alert) [bad](data:text/html,bad) [bad](/settings) [bad](https://user:pass@example.com)";
  const html = renderToStaticMarkup(<AssistantReplyContent text={text} />);
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<a ");
  expect(html).toContain("&lt;script&gt;");
});

it("preserves ordinary chat without forcing a verdict or callout", () => {
  const html = renderToStaticMarkup(<AssistantReplyContent text={"Hello.\n\nYour demo quote is HKD 2,400."} />);
  expect(html).toContain("Hello.\n\nYour demo quote");
  expect(html).not.toContain("<aside");
  expect(html).not.toContain("<h3");
});
