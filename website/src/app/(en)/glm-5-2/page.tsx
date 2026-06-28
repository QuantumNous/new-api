import { GlmLandingPage } from "@/components/glm-landing-page";
import { getGlmLandingMetadataInput } from "@/lib/glm-landing";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata(getGlmLandingMetadataInput("en"));

export default function Page() {
  return <GlmLandingPage locale="en" />;
}
