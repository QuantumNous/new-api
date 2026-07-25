// UX-015 (§33): tool calls render as English one-liners. The model does NOT emit a purpose
// per call — the stream is name+args+result — so the sentence is synthesized here from
// per-tool templates. `run_shell` is the exception: its optional `description` argument is
// model-written intent and is preferred when present. Fallback: "Used <tool> — <short args>".

import { shortArgs } from "./components/ApprovalCard";

// A one-line sentence in three segments so the UI can emphasize the object:
// "Read " + <b>runbook.md</b> + " from the shared folder".
export interface HumanLine {
  pre: string;
  obj?: string;
  post?: string;
}

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const baseName = (p: string) => p.replace(/\/+$/, "").split("/").pop() || p;

// send_message targets are "platform:chat" or "platform:chat:thread" — show the platform
// by name and the last human-ish segment of the chat id.
function messageTarget(target: string): { platform: string; tail: string } {
  const [platform, ...rest] = String(target).split(":");
  const chat = rest[0] || "";
  const tail = chat.includes("/") ? chat.split("/").pop() || chat : chat;
  const names: Record<string, string> = { slack: "Slack", telegram: "Telegram" };
  return { platform: names[platform] || platform, tail };
}

export function humanizeTool(name: string, args: any): HumanLine {
  const a = args && typeof args === "object" ? args : {};
  switch (name) {
    case "run_shell": {
      const cmd = trunc(String(a.command ?? ""), 60);
      const desc = typeof a.description === "string" && a.description.trim() ? a.description.trim() : "";
      const pre = a.run_in_background ? "Started in the background: " : "Ran ";
      return {
        pre,
        obj: cmd,
        ...(desc ? { post: ` — ${desc.charAt(0).toLowerCase()}${desc.slice(1)}` } : {}),
      };
    }
    case "shell_task_output":
      return { pre: "Checked on a background command" };
    case "shell_task_kill":
      return { pre: "Stopped a background command" };
    case "read_file":
      return { pre: "Read ", obj: baseName(String(a.path ?? "a file")) };
    case "write_file":
      return { pre: "Wrote ", obj: baseName(String(a.path ?? "a file")) };
    case "replace_in_file":
    case "apply_patch":
    case "apply_unified_diff":
      return { pre: "Edited ", obj: a.path ? baseName(String(a.path)) : "files" };
    case "grep":
      return { pre: "Searched the code for ", obj: `“${trunc(String(a.pattern ?? ""), 40)}”` };
    case "git_log":
      return { pre: "Looked through recent git history" };
    case "todo_write": {
      // `todos` is current; `items` renders histories from before the rename (the old
      // key breaks Together's GLM-5.2 chat template — see coworker/tools/todo.py).
      const items = Array.isArray(a.todos) ? a.todos : Array.isArray(a.items) ? a.items : [];
      if (items.length === 1) {
        const it = items[0] || {};
        const status = String(it.status || "").replace(/_/g, " ");
        return {
          pre: "Updated the plan — ",
          obj: `“${trunc(String(it.content ?? ""), 70)}”`,
          ...(status ? { post: ` → ${status}` } : {}),
        };
      }
      return { pre: `Updated the plan — ${items.length} items` };
    }
    case "send_message": {
      const { platform, tail } = messageTarget(String(a.target ?? ""));
      if (!tail) return { pre: "Sent a message" };
      return { pre: `Sent a ${platform} message to `, obj: tail };
    }
    case "web_search":
      return { pre: "Searched the web — ", obj: `“${trunc(String(a.query ?? ""), 60)}”` };
    case "web_fetch": {
      let host = String(a.url ?? "");
      try {
        host = new URL(host).host || host;
      } catch {
        /* keep raw */
      }
      return { pre: "Read a web page — ", obj: trunc(host, 50) };
    }
    case "explore":
      return { pre: "Sent a sub-agent to explore — ", obj: `“${trunc(String(a.task ?? a.prompt ?? ""), 60)}”` };
    case "ask_user":
      return { pre: "Asked you a question" };
    case "propose_plan":
      return { pre: "Proposed a plan" };
    case "request_directory":
      return { pre: "Asked for folder access — ", obj: String(a.path ?? "") };
    default: {
      const rest = trunc(shortArgs(a), 80);
      return { pre: `Used ${name}`, ...(rest ? { post: ` — ${rest}` } : {}) };
    }
  }
}

// The approval card's headline (§35): the ask, phrased as the action being decided.
// run_shell leads with the model's own description ("Run a command — fetch stock data").
export function humanizeApprovalTitle(name: string, args: any): HumanLine {
  const a = args && typeof args === "object" ? args : {};
  switch (name) {
    case "write_file":
      return { pre: "Write ", obj: baseName(String(a.path ?? "a file")) };
    case "replace_in_file":
    case "apply_patch":
    case "apply_unified_diff":
      return { pre: "Edit ", obj: a.path ? baseName(String(a.path)) : "files" };
    case "run_shell": {
      const desc = typeof a.description === "string" && a.description.trim() ? a.description.trim() : "";
      return {
        pre: "Run a command",
        ...(desc ? { post: ` — ${desc.charAt(0).toLowerCase()}${desc.slice(1)}` } : {}),
      };
    }
    case "send_message": {
      const { tail } = messageTarget(String(a.target ?? ""));
      return tail ? { pre: "Send a message to ", obj: tail } : { pre: "Send a message" };
    }
    case "send_file": {
      const { tail } = messageTarget(String(a.target ?? ""));
      return tail ? { pre: "Send a file to ", obj: tail } : { pre: "Send a file" };
    }
    case "create_scheduled_task":
      return a.title
        ? { pre: "Create the automation ", obj: `“${trunc(String(a.title), 60)}”` }
        : { pre: "Create an automation" };
    default:
      return { pre: `Use ${name}` };
  }
}

// Approvals with no executed tool call (typically declined): the ask, phrased as intent.
export function humanizeAsk(name: string, args: any): HumanLine {
  const a = args && typeof args === "object" ? args : {};
  switch (name) {
    case "run_shell":
      return { pre: "Wanted to run ", obj: trunc(String(a.command ?? ""), 60) };
    case "write_file":
      return { pre: "Wanted to write ", obj: baseName(String(a.path ?? "a file")) };
    case "replace_in_file":
    case "apply_patch":
    case "apply_unified_diff":
      return { pre: "Wanted to edit ", obj: a.path ? baseName(String(a.path)) : "files" };
    case "send_message": {
      const { platform, tail } = messageTarget(String(a.target ?? ""));
      if (!tail) return { pre: "Wanted to send a message" };
      return { pre: `Wanted to message `, obj: tail, post: ` on ${platform}` };
    }
    default:
      return { pre: `Wanted to use ${name}` };
  }
}
