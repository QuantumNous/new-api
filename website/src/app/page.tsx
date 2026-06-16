import { HomePage } from "@/components/home-page";
import { getCopy } from "@/lib/copy";
import { buildMetadata } from "@/lib/seo";

const copy = getCopy("en");

export const metadata = buildMetadata({
  title: copy.home.title,
  description: copy.home.description,
  pathname: "/",
});

export default function Page() {
  return <HomePage locale="en" />;
}
