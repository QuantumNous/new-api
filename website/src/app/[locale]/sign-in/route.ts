import { notFound } from "next/navigation";
import { isLocale, LOCALES } from "@/lib/locales";
import { redirectToGoogleSignIn } from "../../sign-in-redirect";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function GET(request: Request, props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();

  return redirectToGoogleSignIn(request);
}
