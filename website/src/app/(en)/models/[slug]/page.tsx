import { notFound } from "next/navigation";
import { ModelLandingPage } from "@/components/model-landing-page";
import {
  getModelLandingConfig,
  getModelLandingConfigForPricingModel,
  getModelLandingConfigs,
  resolveModelLandingModels,
} from "@/lib/model-landing";
import { modelPublicPath, resolvePublicModel } from "@/lib/model-public";
import { getPricingData, getVendorName } from "@/lib/pricing";
import { fetchRankingsData } from "@/lib/rankings-live";
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
  const modelWithVendor = {
    ...model,
    vendor_name: model.vendor_name ?? getVendorName(model, pricing.vendors),
  };
  const modelSpecificConfig = getModelLandingConfigForPricingModel(modelWithVendor);
  return buildMetadata({
    title: modelSpecificConfig.seo.title,
    description: modelSpecificConfig.seo.description,
    pathname: modelPublicPath(model.model_name),
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  const config = getModelLandingConfig(params.slug);
  const [pricing, rankings] = await Promise.all([getPricingData(), fetchRankingsData()]);
  const models = pricing.models.map((model) => ({
    ...model,
    vendor_name: model.vendor_name ?? getVendorName(model, pricing.vendors),
  }));

  if (config) {
    return (
      <ModelLandingPage
        config={config}
        locale="en"
        liveModels={resolveModelLandingModels(config, models)}
        allModels={models}
        groupRatio={pricing.groupRatio}
        rankings={rankings}
      />
    );
  }

  // Generic public model page: rankings / directory click-through target.
  const model = resolvePublicModel(models, params.slug);
  if (!model) notFound();
  const modelWithVendor = {
    ...model,
    vendor_name: model.vendor_name ?? getVendorName(model, pricing.vendors),
  };
  const modelSpecificConfig = getModelLandingConfigForPricingModel(modelWithVendor);
  return (
    <ModelLandingPage
      config={modelSpecificConfig}
      locale="en"
      liveModels={resolveModelLandingModels(modelSpecificConfig, [modelWithVendor])}
      allModels={models}
      groupRatio={pricing.groupRatio}
      rankings={rankings}
    />
  );
}
