import { useState } from "react";
import type { Item } from "../types";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";

type PlanItem = Extract<Item, { kind: "planreq" }>;

// The agent (in read-only plan mode) proposed a plan via propose_plan. The user approves it —
// choosing whether execution should keep asking per action or run with full access — or sends
// it back with feedback. Mirrors the directory-request card, shown in the composer head.
export function PlanCard({
  item,
  onRespond,
}: {
  item: PlanItem;
  onRespond: (approved: boolean, mode?: string, feedback?: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [feedback, setFeedback] = useState("");

  return (
    <div className="dirreq-card plan-card">
      <div className="dirreq-head">
        <Icon name="sparkle" size={16} className="ico" />
        <span>The agent proposed a plan</span>
      </div>
      <div className="plan-body">
        <Markdown text={item.plan} />
      </div>
      {rejecting ? (
        <div className="dirreq-actions">
          <input
            className="dirreq-path"
            placeholder="What should change about the plan?"
            value={feedback}
            autoFocus
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && feedback.trim()) onRespond(false, undefined, feedback.trim());
            }}
          />
          <button className="btn" onClick={() => setRejecting(false)}>
            Back
          </button>
          <button
            className="btn primary"
            disabled={!feedback.trim()}
            onClick={() => onRespond(false, undefined, feedback.trim())}
          >
            Send feedback
          </button>
        </div>
      ) : (
        <div className="dirreq-actions">
          <button className="btn" onClick={() => setRejecting(true)}>
            Request changes
          </button>
          <span className="spacer" />
          <button className="btn" onClick={() => onRespond(true, "interactive")}>
            Approve — ask per step
          </button>
          <button className="btn primary" onClick={() => onRespond(true, "auto")}>
            Approve & run
          </button>
        </div>
      )}
    </div>
  );
}
