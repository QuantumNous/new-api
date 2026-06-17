import { ModelLandingPage } from "@/components/model-landing-page";
import { SEEDANCE_CONFIG } from "@/lib/model-landing";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Seedance video API — cheaper than official, OpenAI-compatible key",
  description:
    "Generate Seedance text/image-to-video through flatkey.ai at lower per-second cost, with OpenAI-compatible routing, one API key, and unified billing.",
  pathname: "/models/seedance-api",
});

export default function Page() {
  return <ModelLandingPage config={SEEDANCE_CONFIG} locale="en" />;
}
