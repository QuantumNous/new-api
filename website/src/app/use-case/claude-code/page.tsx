import { CLAUDE_CODE_USE_CASE, CodingAgentUseCasePage } from "@/components/coding-agent-use-case-page";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Flatkey with Claude Code — at least 40% cheaper",
  description:
    "Use Claude Code with Flatkey through one API key, macOS, Linux, and Windows install scripts, at least 40% cheaper usage, and unified billing.",
  pathname: "/use-case/claude-code",
});

export default function Page() {
  return <CodingAgentUseCasePage config={CLAUDE_CODE_USE_CASE} locale="en" />;
}
