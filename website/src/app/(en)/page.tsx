import { HomePage } from "@/components/home-page";
import { getCopy } from "@/lib/copy";
import { buildHomepageSchema, stringifyJsonLd } from "@/lib/schema";
import { buildMetadata } from "@/lib/seo";

const copy = getCopy("en");
const homepageSchema = buildHomepageSchema({
  locale: "en",
  title: copy.home.title,
  description: copy.home.description,
});

export const metadata = buildMetadata({
  title: copy.home.title,
  description: copy.home.description,
  pathname: "/",
});

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: stringifyJsonLd(homepageSchema) }} />
      <HomePage locale="en" />
    </>
  );
}
