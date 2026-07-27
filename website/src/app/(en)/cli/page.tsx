import { CliLandingPage } from "@/components/cli-landing-page";
import { CLI_LANDING_PATH, cliLandingCopy } from "@/lib/cli-landing";
import { buildMetadata } from "@/lib/seo";

const copy = cliLandingCopy.en;

export const metadata = buildMetadata({
  title: copy.seo.title,
  description: copy.seo.description,
  pathname: CLI_LANDING_PATH,
});

export default function Page() {
  return <CliLandingPage locale="en" />;
}
