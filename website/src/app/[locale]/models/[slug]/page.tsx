import { notFound, redirect } from "next/navigation";
import { ModelLandingPage } from "@/components/model-landing-page";
import { isLocale, LOCALES, localizePath } from "@/lib/locales";
import {
  getModelLandingConfig,
  getModelLandingConfigForPricingModel,
  getModelLandingConfigs,
  resolveModelLandingModels,
} from "@/lib/model-landing";
import { modelPublicPath, resolvePublicModel } from "@/lib/model-public";
import { getPricingData, getVendorName, WEBSITE_PUBLIC_PRICING_GROUP } from "@/lib/pricing";
import { fetchRankingsData } from "@/lib/rankings-live";
import { buildMetadata } from "@/lib/seo";
import { getSkagLandingMetadataInput } from "@/lib/skag-landing";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  return LOCALES
    .filter((locale) => locale !== "en")
    .flatMap((locale) => getModelLandingConfigs().map((config) => ({ locale, slug: config.slug })));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  if (params.slug === "gpt-api") {
    return buildMetadata(getSkagLandingMetadataInput("gpt-api", params.locale));
  }
  if (params.slug === "claude-api") {
    return buildMetadata(getSkagLandingMetadataInput("claude-api", params.locale));
  }
  const config = getModelLandingConfig(params.slug);
  if (config) {
    return buildMetadata({
      title: config.seo.title,
      description: config.seo.description,
      pathname: `/models/${config.slug}`,
      locale: params.locale,
    });
  }
  const pricing = await getPricingData(WEBSITE_PUBLIC_PRICING_GROUP);
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
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  if (params.slug === "gpt-api") redirect(localizePath("/gpt-api", params.locale));
  if (params.slug === "claude-api") redirect(localizePath("/claude-api", params.locale));

  const config = getModelLandingConfig(params.slug);
  const [pricing, rankings] = await Promise.all([getPricingData(WEBSITE_PUBLIC_PRICING_GROUP), fetchRankingsData()]);
  const models = pricing.models.map((model) => ({
    ...model,
    vendor_name: model.vendor_name ?? getVendorName(model, pricing.vendors),
  }));

  if (config) {
    return (
      <ModelLandingPage
        config={config}
        locale={params.locale}
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
      locale={params.locale}
      liveModels={resolveModelLandingModels(modelSpecificConfig, [modelWithVendor])}
      allModels={models}
      groupRatio={pricing.groupRatio}
      rankings={rankings}
    />
  );
}
