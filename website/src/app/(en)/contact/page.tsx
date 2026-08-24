import { OnlineContactPage } from "@/components/online-contact-page";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "flatkey - Contact sales",
  description:
    "Talk to flatkey sales for enterprise contracts below self-serve pricing, invoices, token governance and SLA support.",
  pathname: "/contact",
});

export default function Page() {
  return <OnlineContactPage locale="en" />;
}
