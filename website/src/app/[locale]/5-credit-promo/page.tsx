import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FiveCreditPromoPage } from "@/components/five-credit-promo-page";
import { SITE_ORIGIN } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return [{ locale: "pt" }];
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  if (params.locale !== "pt") return {};

  return {
    title: "Ganhe US$5 em Créditos para APIs de IA | Flatkey",
    description: "Crie sua conta na Flatkey, resgate US$5 em créditos e comece a testar APIs de IA.",
    alternates: {
      canonical: `${SITE_ORIGIN}/pt/5-credit-promo`,
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: "Ganhe US$5 em Créditos para APIs de IA | Flatkey",
      description: "Crie sua conta na Flatkey, resgate US$5 em créditos e comece a testar APIs de IA.",
      url: `${SITE_ORIGIN}/pt/5-credit-promo`,
      siteName: "flatkey.ai",
      type: "website",
    },
  };
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (params.locale !== "pt") notFound();
  return <FiveCreditPromoPage />;
}
