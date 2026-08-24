import { ToolsLandingPage } from "@/components/tools-landing-page";
import { getToolsLandingMetadataInput } from "@/lib/tools-landing";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata(getToolsLandingMetadataInput("en"));

export default function Page() {
  return <ToolsLandingPage locale="en" />;
}
