import { notFound } from "next/navigation";
import { SkagLandingPage } from "@/components/skag-landing-page";
import { getSkagLandingConfig, getSkagLandingMetadataInput } from "@/lib/skag-landing";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return [{ locale: "pt" }];
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (params.locale !== "pt") return {};
  return buildMetadata(getSkagLandingMetadataInput("chinese-ai-models-api", "pt"));
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (params.locale !== "pt") notFound();
  return <SkagLandingPage config={getSkagLandingConfig("chinese-ai-models-api", "pt")} />;
}
