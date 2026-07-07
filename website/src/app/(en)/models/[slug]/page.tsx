import { notFound } from "next/navigation";
import { ModelLandingPage } from "@/components/model-landing-page";
import { ModelPublicPage } from "@/components/model-public-page";
import {
  getModelLandingConfig,
  getModelLandingConfigs,
  resolveModelLandingModels,
} from "@/lib/model-landing";
import { buildModelPublicView, modelPublicPath, resolvePublicModel } from "@/lib/model-public";
import { consoleUrl, ROUTER_ORIGIN } from "@/lib/origins";
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
  if (config) {
    return buildMetadata({
      title: config.seo.title,
      description: config.seo.description,
      pathname: `/models/${config.slug}`,
    });
  }
  const pricing = await getPricingData();
  const model = resolvePublicModel(pricing.models, params.slug);
  if (!model) return {};
  return buildMetadata({
    title: `${model.model_name} — pricing, availability & API`,
    description: `Live pricing, 30-day availability and a ready-to-run API example for ${model.model_name} on flatkey.ai.`,
    pathname: modelPublicPath(model.model_name),
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  const config = getModelLandingConfig(params.slug);
  const pricing = await getPricingData();

  if (config) {
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

  // Generic public model page: rankings / directory click-through target.
  const model = resolvePublicModel(pricing.models, params.slug);
  if (!model) notFound();

  return (
    <ModelPublicPage
      locale="en"
      {...buildModelPublicView(model, pricing)}
      apiBaseUrl={`${ROUTER_ORIGIN}/v1`}
      consoleTopUpUrl={consoleUrl("/wallet")}
    />
  );
}
