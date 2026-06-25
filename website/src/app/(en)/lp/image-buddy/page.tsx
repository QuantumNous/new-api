import { EdmLandingPage } from "@/components/edm-landing-page";
import { getEdmCampaign, getEdmMetadataInput } from "@/lib/edm-landing";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata(getEdmMetadataInput("image-buddy", "en"));

export default function Page() {
  return <EdmLandingPage campaign={getEdmCampaign("image-buddy", "en")} locale="en" pathname="/lp/image-buddy" />;
}
