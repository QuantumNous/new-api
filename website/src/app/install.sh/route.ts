import { CLAUDE_CODE_POSIX_INSTALL_SCRIPT } from "@/lib/claude-code-use-case";

export function GET() {
  return new Response(CLAUDE_CODE_POSIX_INSTALL_SCRIPT, {
    headers: {
      "content-disposition": "inline; filename=install.sh",
      "content-type": "text/x-shellscript; charset=utf-8",
    },
  });
}
