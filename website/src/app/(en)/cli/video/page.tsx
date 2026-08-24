import { CliMediaLibraryPage, getCliMediaMetadata } from "@/components/cli-media-library-page";
import { CLI_VIDEO_PATH } from "@/lib/cli-landing";
import { buildMetadata } from "@/lib/seo";

const meta = getCliMediaMetadata("video", "en");

export const metadata = buildMetadata({
  title: meta.title,
  description: meta.description,
  pathname: CLI_VIDEO_PATH,
});

export default function Page() {
  return <CliMediaLibraryPage kind="video" locale="en" />;
}
