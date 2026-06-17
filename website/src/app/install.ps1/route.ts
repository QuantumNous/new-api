import { CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT } from "@/lib/claude-code-use-case";

export function GET() {
  return new Response(CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT, {
    headers: {
      "content-disposition": "inline; filename=install.ps1",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
