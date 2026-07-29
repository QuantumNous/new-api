import { ToolsAdLandingPage } from "@/components/tools-ad-landing-page";
import { getToolsAdLandingConfig, getToolsAdLandingMetadataInput } from "@/lib/tools-ad-landing";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata(getToolsAdLandingMetadataInput("web-scraping-api"));

export default function Page() {
  return <ToolsAdLandingPage config={getToolsAdLandingConfig("web-scraping-api")} />;
}
