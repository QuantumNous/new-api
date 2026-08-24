import { StaticFeaturePage } from "@/components/static-feature-page";
import { buildMetadata } from "@/lib/seo";
import { staticFeaturePages } from "@/lib/static-feature-pages";

const page = staticFeaturePages.status;

export const metadata = buildMetadata({
  title: page.metadataTitle,
  description: page.metadataDescription,
  pathname: page.pathname,
});

export default function Page() {
  return <StaticFeaturePage pageKey="status" locale="en" />;
}
