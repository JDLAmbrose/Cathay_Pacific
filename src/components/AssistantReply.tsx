import type { ReactNode } from "react";
import { cx } from "./primitives";

const calloutIcons = { NOTE: "ⓘ", IMPORTANT: "§", WARNING: "⚠", TIP: "→" };
type CalloutKind = keyof typeof calloutIcons;
type Block = { kind: "text"; body: string[] } | { kind: CalloutKind; title: string; body: string[] };

function safeLink(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** A small display grammar, not an HTML/Markdown execution surface. */
function inline(value: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^\s)]+)\)/g;
  let start = 0;
  for (const match of value.matchAll(pattern)) {
    parts.push(value.slice(start, match.index));
    if (match[1]) parts.push(<strong key={match.index}>{match[1]}</strong>);
    else {
      const href = safeLink(match[3]);
      parts.push(href ? <a key={match.index} href={href} target="_blank" rel="noopener noreferrer" title={href}>
        {match[2]} <span aria-hidden="true">↗</span>
      </a> : match[0]);
    }
    start = match.index + match[0].length;
  }
  parts.push(value.slice(start));
  return parts;
}

export function AssistantReplyContent({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const first = lines[0]?.trim();
  const heading = /^(?:#{1,3}\s+)?(?:\*\*)?(✅|❌|⚠️?)\s*(.+?)(?:\*\*)?$/.exec(first);
  if (heading) lines.shift();
  const blocks: Block[] = [];
  let block: Block | undefined;
  const flush = () => { if (block && (block.kind !== "text" || block.body.some((line) => line.trim()))) blocks.push(block); block = undefined; };
  for (const line of lines) {
    const header = /^>\s*\[!(NOTE|IMPORTANT|WARNING|TIP)\]\s*(.*)$/.exec(line);
    if (header) {
      flush();
      block = { kind: header[1] as CalloutKind, title: header[2].replace(/^\*\*|\*\*$/g, ""), body: [] };
    } else if (block && block.kind !== "text" && (line.startsWith(">") || !line.trim())) {
      block.body.push(line.replace(/^> ?/, ""));
    } else {
      if (block?.kind !== "text") { flush(); block = { kind: "text", body: [] }; }
      block.body.push(line);
    }
  }
  flush();
  const verdict = heading?.[1] === "✅" ? "yes" : heading?.[1] === "❌" ? "no" : "unknown";
  return <div className={cx("agent-reply")}>
    {heading && <h3 className={cx(`agent-verdict agent-verdict-${verdict}`)}>
      <span aria-hidden="true">{heading[1]}</span> <strong>{heading[2].replace(/\*\*/g, "")}</strong>
    </h3>}
    {blocks.map((item, index) => item.kind === "text"
      ? <div className={cx("message-text")} key={index}>{inline(item.body.join("\n").trim())}</div>
      : <aside className={cx(`agent-callout agent-callout-${item.kind.toLowerCase()}`)} key={index}>
        {item.title && <h4><span aria-hidden="true">{calloutIcons[item.kind]}</span> {item.title}</h4>}
        <div className={cx("message-text")}>{inline(item.body.join("\n").trim())}</div>
      </aside>)}
    {streaming && <span className={cx("agent-cursor")} aria-hidden="true" />}
  </div>;
}
