import { ModelLandingPage } from "@/components/model-landing-page";
import { GPT_CONFIG } from "@/lib/model-landing";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "GPT API pricing with one OpenAI-compatible key",
  description:
    "Use GPT models through flatkey.ai with OpenAI-compatible routing, lower token costs, one API key, and unified billing.",
  pathname: "/models/gpt-api",
});

export default function Page() {
  return <ModelLandingPage config={GPT_CONFIG} locale="en" />;
}
