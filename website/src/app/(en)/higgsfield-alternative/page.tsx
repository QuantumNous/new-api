import { HiggsfieldAlternativePage } from "@/components/cli-landing-page";
import { HIGGSFIELD_ALTERNATIVE_PATH, higgsfieldAlternativeCopy } from "@/lib/cli-landing";
import { buildMetadata } from "@/lib/seo";

const copy = higgsfieldAlternativeCopy.en;

export const metadata = buildMetadata({
  title: copy.seo.title,
  description: copy.seo.description,
  pathname: HIGGSFIELD_ALTERNATIVE_PATH,
});

export default function Page() {
  return <HiggsfieldAlternativePage locale="en" />;
}
