import { SkagLandingPage } from "@/components/skag-landing-page";
import { getSkagLandingConfig, getSkagLandingMetadataInput } from "@/lib/skag-landing";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata(getSkagLandingMetadataInput("gpt-api"));

export default function Page() {
  return <SkagLandingPage config={getSkagLandingConfig("gpt-api")} />;
}
