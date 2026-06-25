import { PublicPage } from "@/components/public-page";
import { getPageContent } from "@/content/pages";
import { buildMetadata } from "@/lib/seo";

const content = getPageContent("rankings", "en");

export const metadata = buildMetadata({
  title: content.title,
  description: content.description,
  pathname: "/rankings",
});

export default function Page() {
  return <PublicPage locale="en" pageKey="rankings" pathname="/rankings" />;
}
