export type EventType =
  | "ready"
  | "inbound"
  | "turn_start"
  | "assistant_delta"
  | "reasoning_delta"
  | "assistant_message"
  | "tool_proposed"
  | "permission_required"
  | "directory_requested"
  | "question_requested"
  | "plan_proposed"
  | "tool_started"
  | "tool_finished"
  | "iteration_end"
  | "turn_end"
  | "error"
  | "interrupted"
  | "model_changed"
  | "turn_done";

export interface WsEvent {
  type: EventType;
  data: any;
}

// Re-exported for transcript items below. Lives in api.ts (the REST/WS contract source of truth);
// type-only import, so there's no runtime cycle with api.ts's `import type { ... } from "./types"`.
import type { MessageSource } from "./api";

// "always_task" persists to the owning automation's task record (standing scoped
// approval, UX-DECISIONS §25) — offered only on automation-run approval cards, in-app.
export type ApprovalDecision = "once" | "deny" | "always_tool" | "always_command" | "always_task";

export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "done";
}

export interface SessionInfo {
  session_id: string;
  title?: string;
  workspace: string;
  agent: string;
  model: string;
  mode: string;
  updated_at: string | null;
  messages: number;
  pinned?: boolean;
  archived?: boolean;
  // Inbox items awaiting this session (the amber attention count that bubbles up the sidebar).
  attention?: number;
  // working = in-flight turn; sleeping = a self-wake is pending; idle = neither. A count-less dot.
  liveness?: "working" | "sleeping" | "idle";
  // Channels this session listens to (inbound subscriptions).
  subscriptions?: string[];
  // §31: set when the session was spawned by a platform mention rather than the user —
  // machine key ("slack") + display label ("#general · T0ABCD"). Drives the sidebar's
  // "From Slack" group and the row's platform icon.
  origin?: string;
  origin_label?: string;
}

// Attachments (images, PDFs, text files) sent with a user message.
export interface Attachment {
  kind: "image" | "text" | "pdf";
  name: string;
  mime?: string;
  data_url?: string; // images + PDFs
  text?: string; // text files
}

// Transcript items
// `ts` = unix seconds (the server's canonical-message stamp; live items stamp locally).
// Optional: sessions saved before the server stamped timestamps have none.
export type Item =
  | { kind: "user"; text: string; attachments?: Attachment[]; ts?: number }
  // A connector-delivered inbound message (Slack/Salesforce/…), rendered as a structured card
  // (ConnectorMessageCard) instead of a plain user bubble. Generalizes to any connector via the
  // registry — no per-connector special-casing.
  | { kind: "connector"; source: MessageSource }
  | { kind: "assistant"; text: string; ts?: number; reasoning?: string }
  // `hidden` = results the user's privacy filters removed before the agent saw them
  // (from the tool message's `_display` sidecar; the agent-visible content has no trace).
  // `standingRule` = the task-scoped rule that auto-allowed this call ("tool → target").
  | { kind: "tool"; id: string; name: string; args: any; status: string; preview?: string; hidden?: number; standingRule?: string }
  | {
      kind: "approval";
      name: string;
      args: any;
      reason: string;
      category?: string;
      // The exact target a standing rule could pin (server-computed) — with a run
      // context, the card offers "Allow every time" (§25).
      standingTarget?: string;
      resolved?: ApprovalDecision;
    }
  | {
      kind: "dirreq";
      reason: string;
      path?: string;
      writable?: boolean;
      resolved?: "granted" | "denied";
    }
  | {
      kind: "planreq";
      plan: string;
      resolved?: "approved" | "rejected";
    }
  | {
      // A live ask_user prompt (attended sessions answer inline; unattended ones route to the Inbox).
      kind: "question";
      question: string;
      options?: string[];
      allow_text?: boolean;
      multi?: boolean;
      resolved?: string;
    }
  | { kind: "notice"; tone: "info" | "warn"; text: string; retriable?: boolean };
