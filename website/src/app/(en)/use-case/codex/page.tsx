import { CODEX_USE_CASE, CodingAgentUseCasePage } from "@/components/coding-agent-use-case-page";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Flatkey with Codex — at least 40% cheaper",
  description:
    "Use Codex CLI with Flatkey through one API key, macOS, Linux, and Windows install scripts, at least 40% cheaper usage, and unified billing.",
  pathname: "/use-case/codex",
});

export default function Page() {
  return <CodingAgentUseCasePage config={CODEX_USE_CASE} locale="en" />;
}
