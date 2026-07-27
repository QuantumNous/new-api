// Screenshot-only overlay on the e2e mocks.
//
// The regression fixtures are tuned for assertions: the fake agent echoes the prompt back and
// the app starts signed out. Neither belongs in a product screenshot, so this layer replaces
// the session socket with a scripted realistic turn and puts the app in a signed-in state.
// Playwright matches the most recently registered route first, so these win over mockApi's.
import { test as hermetic, CLOUD_STATE } from "../e2e/fixtures";

const ACCOUNT = "you@you-box.com";

const REPLY = `Done — the launch note is written and staged.

**What I did**
1. Pulled the Q3 revenue and retention numbers from the finance sheet in your workspace.
2. Drafted \`launch-note.md\` with the summary, the three headline metrics, and a short FAQ.
3. Exported \`launch-note.docx\` alongside it so you can share it as-is.

Revenue is up 18% quarter over quarter and net retention landed at 112%, so I led with those
two and moved the roadmap section below the fold.

Want me to post the summary to **#launch-team**? I'll show you the exact message first.`;

export const test = hermetic.extend({
  page: async ({ page }, use) => {
    Object.assign(CLOUD_STATE, {
      signed_in: true,
      account: ACCOUNT,
      user_id: "u_boxai",
      telemetry_enabled: false,
    });

    await page.routeWebSocket(/\/ws\/session\//, (ws) => {
      const send = (type: string, data: Record<string, unknown> = {}) =>
        ws.send(JSON.stringify({ type, data }));
      send("ready");
      ws.onMessage((raw) => {
        const msg = JSON.parse(String(raw));
        if (msg.type !== "user_message") return;
        send("turn_start", { input: msg.text });
        if (/#launch-team/.test(msg.text)) {
          const args = { target: "slack:T1DL/#launch-team", text: "Launch note is ready — summary in thread." };
          send("tool_proposed", { name: "send_message", arguments: args });
          send("permission_required", {
            name: "send_message",
            arguments: args,
            reason: "",
            category: "messaging",
            standing_target: "slack:T1DL/#launch-team",
          });
          return;
        }
        send("assistant_message", { text: REPLY });
        send("turn_done");
      });
    });

    await use(page);
  },
});
