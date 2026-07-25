import { useState } from "react";
import type { ApprovalDecision, Item } from "../types";
import { shortArgs } from "./ApprovalCard";
import { humanizeAsk, humanizeTool, type HumanLine } from "../humanize";
import { Markdown } from "./Markdown";
import { ConnectorMessageCard } from "./ConnectorMessageCard";
import { Icon } from "./Icon";

// Hover affordances for a message bubble (FB-005): copy the raw text + the message's time.
// Lives in a ZERO-HEIGHT strip under the bubble (absolute, inside the transcript's 20px gap)
// so revealing it on group-hover never shifts the layout. `ts` is unix seconds — canonical
// messages carry it, pre-stamp history doesn't, so the time simply omits itself when absent.
function BubbleMeta({ text, ts, align }: { text: string; ts?: number; align: "left" | "right" }) {
  const [copied, setCopied] = useState(false);
  const when = typeof ts === "number" ? new Date(ts * 1000) : null;
  const copy = () => {
    // "Copied" only after the write actually lands — WebKit can reject outside a
    // trusted gesture, and claiming success on a silent no-op would gaslight the user.
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {});
  };
  return (
    <div className="relative h-0 select-none">
      <div
        className={
          "absolute top-1 flex items-center gap-1.5 text-[10.5px] leading-none text-faint whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity " +
          (align === "right" ? "right-0" : "left-0")
        }
      >
        <button
          className="flex items-center cursor-pointer hover:text-muted"
          data-testid="bubble-copy"
          title="Copy message"
          onClick={copy}
        >
          {copied ? "Copied" : <Icon name="copy" size={11} />}
        </button>
        {when && (
          <span data-testid="bubble-ts" title={when.toLocaleString()}>
            {when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}

// Reasoning-model thinking text (model-layer roadmap item 4): a quiet disclosure —
// collapsed by default, the trace one click away. `live` = still streaming (pulsing label);
// App renders that variant above the transcript, this one rides a finalized assistant item.
export function ThinkingBlock({ text, live }: { text: string; live?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="thinking">
      <button
        className="thinking-head"
        onClick={() => setOpen((v) => !v)}
        data-testid="thinking-toggle"
      >
        <Icon name="chevronDown" size={12} className={"thinking-caret" + (open ? " open" : "")} />
        <span className={live ? "thinking-live" : undefined}>
          {live ? "Thinking…" : "Thought process"}
        </span>
      </button>
      {open && (
        <div className="thinking-body" data-testid="thinking-body">
          {text}
        </div>
      )}
    </div>
  );
}

type ToolItem = Extract<Item, { kind: "tool" }>;
type ApprovalItem = Extract<Item, { kind: "approval" }>;
type AssistantItem = Extract<Item, { kind: "assistant" }>;
type TurnItem = ToolItem | ApprovalItem | AssistantItem;

// TurnGroup (§33, absorbs §7's StepGroup): the whole user-message → final-answer span collapses
// as ONE disclosure — "N steps" — with the agent's narration (assistant text followed by more
// activity in the same turn) and humanized one-line steps interleaved inside. The final assistant
// text renders as a normal bubble OUTSIDE the group (see the flush logic in Transcript below).
// Approvals fold into their tool's row as a chip; an approval with no executed call (typically
// declined) keeps its own "Wanted to …" row. Raw args+result stay one click away per row.

type TurnRow =
  | { type: "narr"; text: string }
  | { type: "step"; tool: ToolItem; approval?: ApprovalItem }
  | { type: "ask"; approval: ApprovalItem };

function buildRows(items: TurnItem[]): TurnRow[] {
  // First pass: tool rows in order; then pair each resolved approval with the nearest
  // same-name tool that doesn't have one yet (approvals may stream before or after their call).
  const rows: TurnRow[] = items
    .filter((it): it is ToolItem | AssistantItem => it.kind !== "approval")
    // Thinking-only assistant items (no text) carry nothing narratable — skip the row.
    .filter((it) => it.kind !== "assistant" || it.text)
    .map((it) =>
      it.kind === "assistant" ? { type: "narr" as const, text: it.text } : { type: "step" as const, tool: it },
    );
  const approvals = items.filter((it): it is ApprovalItem => it.kind === "approval");
  for (const ap of approvals) {
    const at = items.indexOf(ap);
    let bestRow: Extract<TurnRow, { type: "step" }> | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind !== "tool" || it.name !== ap.name) continue;
      const row = rows.find((r) => r.type === "step" && r.tool === it) as
        | Extract<TurnRow, { type: "step" }>
        | undefined;
      if (!row || row.approval) continue;
      const dist = Math.abs(i - at);
      if (dist < bestDist) {
        bestRow = row;
        bestDist = dist;
      }
    }
    if (bestRow && ap.resolved !== "deny") bestRow.approval = ap;
    else {
      // No executed call to attach to (or it was declined) — the ask keeps its own row,
      // placed where the approval sat in the stream.
      const after = items.slice(0, at).filter((it) => it.kind !== "approval").length;
      rows.splice(after, 0, { type: "ask", approval: ap });
    }
  }
  return rows;
}

function approvalChip(resolved: ApprovalDecision | undefined) {
  if (resolved === "deny")
    return <span className="text-[10.5px] px-1.5 rounded-full bg-dangerSoft text-danger shrink-0">✕ declined</span>;
  return (
    <span
      className="text-[10.5px] px-1.5 rounded-full bg-okSoft text-ok shrink-0"
      title={resolved ? `approved · ${resolved.replace(/_/g, " ")}` : "approved"}
    >
      ✓ approved
    </span>
  );
}

function LineText({ line }: { line: HumanLine }) {
  return (
    <span className="min-w-0 text-[13px] leading-relaxed">
      <span className="text-muted">{line.pre}</span>
      {line.obj && <span className="text-ink">{line.obj}</span>}
      {line.post && <span className="text-muted">{line.post}</span>}
    </span>
  );
}

function StepRow({ tool, approval }: { tool: ToolItem; approval?: ApprovalItem }) {
  const [raw, setRaw] = useState(false);
  const running = tool.status === "…";
  const failed = tool.status !== "ok" && !running;
  return (
    <div>
      <div className="group flex items-baseline gap-2 px-2 py-0.5 rounded-lg hover:bg-paper" data-testid="turn-step">
        <span className={"w-3.5 text-center text-[10px] shrink-0 " + (failed ? "text-danger" : running ? "text-accent" : "text-ok")}>
          {running ? <span className="spinner" data-testid="step-running" /> : "●"}
        </span>
        <LineText line={humanizeTool(tool.name, tool.args)} />
        {approval && approvalChip(approval.resolved)}
        {!!tool.standingRule && (
          <span
            className="text-[10.5px] px-1.5 rounded-full bg-tealSoft text-tealInk shrink-0"
            data-testid="tool-standing-rule"
            title={`Auto-allowed by this automation's standing approval: ${tool.standingRule}. Revoke on its Automations page.`}
          >
            auto-allowed
          </span>
        )}
        {!!tool.hidden && (
          <span
            className="text-[11px] text-warnInk shrink-0"
            data-testid="tool-hidden-count"
            title="Removed by your privacy filters before the agent saw the results — agents get no trace of these."
          >
            {tool.hidden} hidden
          </span>
        )}
        {failed && <span className="text-[11px] text-danger shrink-0">{tool.status}</span>}
        {!running && (
          <button
            className="ml-auto shrink-0 text-[11px] text-faint opacity-0 group-hover:opacity-100 cursor-pointer"
            onClick={() => setRaw((v) => !v)}
          >
            raw
          </button>
        )}
      </div>
      {raw && (
        <pre className="ml-8 mr-2 my-1 px-2.5 py-1.5 rounded-lg border border-line bg-paper font-mono text-[11.5px] leading-relaxed text-muted whitespace-pre-wrap break-words max-h-56 overflow-auto">
          {`${tool.name}  ${shortArgs(tool.args)}`}
          {tool.preview ? `\n→ ${tool.preview.length > 1500 ? tool.preview.slice(0, 1500) + "\n…" : tool.preview}` : ""}
        </pre>
      )}
    </div>
  );
}

function TurnGroup({
  items,
  live,
  streamingText,
}: {
  items: TurnItem[];
  live?: boolean;
  // Sub-threshold streamed text belongs to THIS group (§33 ref #3): collapsed → it rides
  // the header as the live line; expanded → the small quiet line under the steps.
  streamingText?: string;
}) {
  // Turns start COLLAPSED, running or not (owner call 2026-07-14) — the header's live
  // line is the pulse; expanding is opt-in.
  const rows = buildRows(items);
  const tools = items.filter((it): it is ToolItem => it.kind === "tool");
  const running = live || tools.some((t) => t.status === "…");
  const [userToggle, setUserToggle] = useState<boolean | null>(null);
  const open = userToggle ?? false;
  const lastNarr = [...items].reverse().find((it): it is AssistantItem => it.kind === "assistant");
  const liveLine = streamingText || lastNarr?.text || "";

  const nSteps = rows.filter((r) => r.type !== "narr").length;
  const declined = items.filter((it) => it.kind === "approval" && it.resolved === "deny").length;
  const hiddenTotal = tools.reduce((n, t) => n + (t.hidden || 0), 0);
  const stepsLabel = `${nSteps} step${nSteps === 1 ? "" : "s"}`;

  return (
    <details className="stepgroup" open={open}>
      <summary
        className="stepgroup-head flex items-center gap-2 py-0.5 cursor-pointer select-none text-[12.5px] text-faint hover:text-muted"
        onClick={(e) => {
          e.preventDefault(); // drive open/closed from state, not the native toggle
          setUserToggle(!open);
        }}
      >
        <span className={"chev inline-block transition-transform" + (open ? " rotate-90" : "")}>›</span>
        <span>
          <span>{running ? `Running ${stepsLabel}…` : stepsLabel}</span>
          {declined > 0 && (
            <>
              {" · "}
              <span className="text-danger" data-testid="stepgroup-declined">
                {declined} declined
              </span>
            </>
          )}
          {hiddenTotal > 0 && (
            <>
              {" · "}
              <span className="text-warnInk" data-testid="stepgroup-hidden">
                {hiddenTotal} hidden by your filters
              </span>
            </>
          )}
        </span>
        {running && !open && liveLine && (
          <span className="min-w-0 flex-1 truncate" data-testid="turn-live-line">
            · {liveLine}
          </span>
        )}
      </summary>
      {open && (
        <div className="ml-1.5 mt-1 pl-2 border-l-2 border-line flex flex-col gap-0.5">
          {rows.map((row, i) =>
            row.type === "narr" ? (
              <div className="turn-narr px-2 py-1 text-[13px] text-muted max-w-[60ch]" key={i} data-testid="turn-narration">
                <Markdown text={row.text} />
              </div>
            ) : row.type === "ask" ? (
              <div className="flex items-baseline gap-2 px-2 py-0.5" key={i} data-testid="turn-ask">
                <span className={"w-3.5 text-center text-[10px] shrink-0 " + (row.approval.resolved === "deny" ? "text-danger" : "text-ok")}>●</span>
                <LineText line={humanizeAsk(row.approval.name, row.approval.args)} />
                {approvalChip(row.approval.resolved)}
              </div>
            ) : (
              <StepRow tool={row.tool} approval={row.approval} key={i} />
            ),
          )}
          {streamingText && (
            <div
              className="turn-narr px-2 py-1 text-[13px] text-muted max-w-[60ch]"
              data-testid="turn-live-stream"
            >
              <Markdown text={streamingText} />
              <span className="stream-cursor">▍</span>
            </div>
          )}
        </div>
      )}
    </details>
  );
}

interface Props {
  items: Item[];
  onApprove: (decision: ApprovalDecision) => void;
  // The session's live flag. While true, the FINAL run's trailing assistant text is still
  // narration (status), not the answer — promoting it early made each line flash as a full
  // ASSISTANT bubble and then vanish into the group when the next tool call arrived
  // (owner report 2026-07-13). The answer bubble appears once, when the turn ends.
  running?: boolean;
  // Sub-threshold streamed text (streamGate mode "quiet") — handed to the live turn group.
  streamingText?: string;
  // Re-run the failed turn (no new user message). Offered only on a retriable notice that
  // is the transcript tail of an idle session — anywhere else the error is history.
  onRetry?: () => void;
}

// The transcript index whose notice gets the Retry button: the tail error notice, looking
// through info notices after it (model switches must not consume the retry — switching
// models and THEN retrying is the intended recovery path). -1 when the tail is anything else.
export function retryAnchor(items: Item[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.kind !== "notice") return -1;
    if (it.retriable) return i;
    if (it.tone !== "info") return -1;
  }
  return -1;
}

export function Transcript({ items, running, streamingText, onRetry }: Props) {
  // §33 grouping: a turn = the maximal run of assistant/tool/resolved-approval items between
  // breakers (user, connector, notices, plan/dir requests…). Trailing assistant texts are the
  // ANSWER and render as bubbles after the group; interior assistant texts are narration and
  // stay inside. A run with no activity at all is just bubbles (unchanged chat behavior).
  const blocks: Array<{ turn: TurnItem[]; live?: boolean } | { item: Item; i: number }> = [];
  let run: TurnItem[] = [];
  const flush = (live = false) => {
    if (!run.length) return;
    const turn = [...run];
    run = [];
    const answers: AssistantItem[] = [];
    // A live run with tool activity keeps its trailing text inside as the status line;
    // a live run with NO activity is a plain streaming reply — bubbles, as ever.
    const keepTrailing = live && turn.some((it) => it.kind !== "assistant");
    if (!keepTrailing)
      while (turn.length && turn[turn.length - 1].kind === "assistant")
        answers.unshift(turn.pop() as AssistantItem);
    if (turn.some((it) => it.kind !== "assistant")) blocks.push({ turn, live });
    else turn.forEach((t) => blocks.push({ item: t, i: -1 }));
    answers.forEach((a) => blocks.push({ item: a, i: -1 }));
  };
  items.forEach((item, i) => {
    if (item.kind === "tool" || item.kind === "assistant" || (item.kind === "approval" && item.resolved))
      run.push(item);
    else if (
      // PENDING interactive items render elsewhere (approval/question → composer head) and
      // nothing here — if they broke the run, the trailing narration would flash into an
      // answer bubble exactly while the user is being asked to decide.
      (item.kind === "approval" || item.kind === "dirreq" || item.kind === "planreq" || item.kind === "question") &&
      !item.resolved
    ) {
      return;
    } else {
      flush();
      blocks.push({ item, i });
    }
  });
  flush(!!running);

  const lastTurnIndex = blocks.reduce((acc, b, i) => ("turn" in b ? i : acc), -1);
  return (
    <div className="transcript">
      {blocks.map((block, bi) => {
        if ("turn" in block)
          return (
            <TurnGroup
              items={block.turn}
              live={block.live}
              streamingText={block.live && bi === lastTurnIndex ? streamingText : undefined}
              key={bi}
            />
          );
        const { item } = block;
        switch (item.kind) {
          case "connector":
            return <ConnectorMessageCard source={item.source} key={bi} />;
          case "user":
            return (
              <div className="group self-end max-w-[78%] flex flex-col items-end" key={bi}>
                <div className="bubble-user px-3.5 py-2.5 rounded-[14px_14px_4px_14px] bg-solid text-onSolid text-[14.5px] leading-relaxed whitespace-pre-wrap">
                  {item.attachments && item.attachments.length > 0 && (
                    <div className="bubble-attachments">
                      {item.attachments.map((a, i) =>
                        a.kind === "image" ? (
                          <img key={i} className="msg-img" src={a.data_url} alt={a.name} />
                        ) : (
                          <span key={i} className="msg-file">📄 {a.name}</span>
                        ),
                      )}
                    </div>
                  )}
                  {item.text}
                </div>
                <BubbleMeta text={item.text} ts={item.ts} align="right" />
              </div>
            );
          case "assistant":
            // Thinking-only item (stopped mid-reasoning): just the disclosure, no bubble.
            if (!item.text && item.reasoning)
              return (
                <div key={bi}>
                  <ThinkingBlock text={item.reasoning} />
                </div>
              );
            return (
              <div className="group bubble-assistant" key={bi}>
                <div className="who">assistant</div>
                {item.reasoning && <ThinkingBlock text={item.reasoning} />}
                <Markdown text={item.text} />
                <BubbleMeta text={item.text} ts={item.ts} align="left" />
              </div>
            );
          case "dirreq":
            if (!item.resolved) return null;
            return (
              <div className="approval-inline" key={bi}>
                <span className={"status " + (item.resolved === "granted" ? "ok" : "denied")}>
                  {item.resolved === "granted" ? "✓" : "✕"}
                </span>
                <span>{item.resolved === "granted" ? "Granted folder access" : "Declined folder access"}</span>
                {item.path && <span className="dim">{item.path}</span>}
              </div>
            );
          case "planreq":
            if (!item.resolved) return null; // pending plan renders in the composer head
            return (
              <div className="bubble-assistant" key={bi}>
                <div className="who">proposed plan</div>
                <Markdown text={item.plan} />
                <div className="approval-inline">
                  <span className={"status " + (item.resolved === "approved" ? "ok" : "denied")}>
                    {item.resolved === "approved" ? "✓" : "✕"}
                  </span>
                  <span>{item.resolved === "approved" ? "Plan approved" : "Sent back with feedback"}</span>
                </div>
              </div>
            );
          case "notice":
            return (
              <div className={"notice " + (item.tone === "warn" ? "warn" : "")} key={bi}>
                {item.text}
                {item.retriable && !running && onRetry && block.i === retryAnchor(items) && (
                  <button className="btn ml-2" data-testid="notice-retry" onClick={onRetry}>
                    Retry
                  </button>
                )}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
