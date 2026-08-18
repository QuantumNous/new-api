import { CareersPage } from "@/components/careers-page";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Careers — Build the AI-native company, from Silicon Valley",
  description:
    "Join a small, happy, AI-native team in San Jose. Every person works with a fleet of agents. We hire builders and growth engineers who ship.",
  pathname: "/careers",
  locales: ["en", "zh"],
});

export default function Page() {
  return <CareersPage locale="en" pathname="/careers" />;
}
