import { OnlinePricingPage } from "@/components/online-pricing-page";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "flatkey - Pricing",
  description:
    "flatkey pricing with Go, Pro, Max and Enterprise plans covering official models, media credits and pay-per-call tools.",
  pathname: "/pricing",
});

export default function Page() {
  return <OnlinePricingPage locale="en" />;
}
