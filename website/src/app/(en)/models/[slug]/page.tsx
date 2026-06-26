import { notFound } from "next/navigation";
import { ModelLandingPage } from "@/components/model-landing-page";
import {
  getModelLandingConfig,
  getModelLandingConfigs,
  resolveModelLandingModels,
} from "@/lib/model-landing";
import { getPricingData, getVendorName } from "@/lib/pricing";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getModelLandingConfigs().map((config) => ({ slug: config.slug }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  const config = getModelLandingConfig(params.slug);
  if (!config) return {};
  return buildMetadata({
    title: config.seo.title,
    description: config.seo.description,
    pathname: `/models/${config.slug}`,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  const config = getModelLandingConfig(params.slug);
  if (!config) notFound();

  const pricing = await getPricingData();
  const models = pricing.models.map((model) => ({
    ...model,
    vendor_name: model.vendor_name ?? getVendorName(model, pricing.vendors),
  }));

  return (
    <ModelLandingPage
      config={config}
      locale="en"
      liveModels={resolveModelLandingModels(config, models)}
    />
  );
}
