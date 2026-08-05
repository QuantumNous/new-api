import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { consoleUrl } from "@/lib/origins";
import { isLocale, LOCALES } from "@/lib/locales";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function GET(request: Request, props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();

  return NextResponse.redirect(consoleUrl("/sign-in", new URL(request.url).search), 301);
}
