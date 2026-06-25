import { PublicPage } from "@/components/public-page";
import { getPageContent } from "@/content/pages";
import { buildMetadata } from "@/lib/seo";

const content = getPageContent("terms", "en");

export const metadata = buildMetadata({
  title: content.title,
  description: content.description,
  pathname: "/terms",
});

export default function Page() {
  return <PublicPage locale="en" pageKey="terms" pathname="/terms" />;
}
