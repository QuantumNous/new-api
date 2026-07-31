import { notFound } from "next/navigation";
import { OnlineHomePage } from "@/components/online-home-page";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  const zh = params.locale === "zh";
  return buildMetadata({
    title: zh ? "flatkey — One key. More models. More tools. Lower costs." : "flatkey - One key. More models. More tools. Lower costs.",
    description: zh
      ? "flatkey 用一个 key 把你的请求路由到 GPT、Claude、Gemini、DeepSeek、GLM——以及 Seedance 2.5 视频——的官方 API:真模型、不降智、不跑路。国产系模型官方 6 折起,每次充值送 15–50% 额度($200 送 $100)——旗舰实付低至官方 ⅔,国产系低至 4 折。改一行代码,SDK 不动。"
      : "flatkey routes your requests to official GPT, Claude, Gemini, DeepSeek, Qwen and GLM APIs, with 300+ frontier models and 1,000+ AI tools behind one key.",
    pathname: "/",
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === DEFAULT_LOCALE) notFound();
  return <OnlineHomePage locale={params.locale} />;
}
