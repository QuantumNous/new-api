import { HomePage } from "@/components/home-page";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "AI API gateway for production teams",
  description:
    "flatkey.ai unifies AI model access, routing, billing, usage analytics, and operations controls for production teams.",
  pathname: "/",
});

export default function Page() {
  return <HomePage locale="en" />;
}
