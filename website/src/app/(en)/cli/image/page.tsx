import { CliMediaLibraryPage, getCliMediaMetadata } from "@/components/cli-media-library-page";
import { CLI_IMAGE_PATH } from "@/lib/cli-landing";
import { buildMetadata } from "@/lib/seo";

const meta = getCliMediaMetadata("image", "en");

export const metadata = buildMetadata({
  title: meta.title,
  description: meta.description,
  pathname: CLI_IMAGE_PATH,
});

export default function Page() {
  return <CliMediaLibraryPage kind="image" locale="en" />;
}
