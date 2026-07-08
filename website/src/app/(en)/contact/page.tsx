import { ContactPage } from "@/components/contact-page";
import { getHomeCopy } from "@/lib/home-copy";
import { buildMetadata } from "@/lib/seo";

const support = getHomeCopy("en").support;

export const metadata = buildMetadata({
  title: support.title,
  description: support.description,
  pathname: "/contact",
});

export default function Page() {
  return <ContactPage locale="en" />;
}
