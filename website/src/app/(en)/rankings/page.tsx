import { RankingsPage } from "@/components/rankings-page";
import { getPageContent } from "@/content/pages";
import { buildMetadata } from "@/lib/seo";

const content = getPageContent("rankings", "en");

export const metadata = buildMetadata({
  title: content.title,
  description: content.description,
  pathname: "/rankings",
});

// Data revalidates hourly; the daily curve itself is a pure function of the
// calendar date, so the page effectively updates once a day.
export const revalidate = 3600;

export default function Page() {
  return <RankingsPage locale="en" pathname="/rankings" />;
}
