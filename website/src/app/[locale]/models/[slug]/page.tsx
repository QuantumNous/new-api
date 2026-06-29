import { notFound } from "next/navigation";
import { ModelLandingPage } from "@/components/model-landing-page";
import { isLocale, LOCALES } from "@/lib/locales";
import {
  getModelLandingConfig,
  getModelLandingConfigs,
  resolveModelLandingModels,
} from "@/lib/model-landing";
import { getPricingData, getVendorName } from "@/lib/pricing";
import { buildMetadata } from "@/lib/seo";

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
  const config = getModelLandingConfig(params.slug);
  if (!config) return {};
  return buildMetadata({
    title: config.seo.title,
    description: config.seo.description,
    pathname: `/models/${config.slug}`,
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();

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
      locale={params.locale}
      liveModels={resolveModelLandingModels(config, models)}
    />
  );
}
