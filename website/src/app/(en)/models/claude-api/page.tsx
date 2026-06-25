import { ModelLandingPage } from "@/components/model-landing-page";
import { CLAUDE_CONFIG } from "@/lib/model-landing";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Claude API pricing with one OpenAI-compatible key",
  description:
    "Use Claude through flatkey.ai with OpenAI-compatible routing, lower token costs, one API key, and unified billing.",
  pathname: "/models/claude-api",
});

export default function Page() {
  return <ModelLandingPage config={CLAUDE_CONFIG} locale="en" />;
}
