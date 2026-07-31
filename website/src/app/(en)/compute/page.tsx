import { StaticFeaturePage } from "@/components/static-feature-page";
import { staticFeaturePages } from "@/lib/static-feature-pages";
import { buildMetadata } from "@/lib/seo";

const page = staticFeaturePages.compute;

export const metadata = buildMetadata({
  title: page.metadataTitle,
  description: page.metadataDescription,
  pathname: page.pathname,
});

export default function Page() {
  return <StaticFeaturePage pageKey="compute" locale="en" />;
}
