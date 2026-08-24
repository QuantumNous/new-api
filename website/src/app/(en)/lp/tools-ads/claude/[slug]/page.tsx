import { notFound } from "next/navigation";
import { ClaudeToolsAdLandingPage } from "@/components/claude-tools-ad-landing-page";
import {
  CLAUDE_TOOLS_AD_SLUGS,
  getClaudeToolsAdConfig,
  type ClaudeToolsAdSlug,
} from "@/lib/claude-tools-ad-landing";

export const metadata = {
  title: "Flatkey Tools Ads — Claude concept",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return CLAUDE_TOOLS_AD_SLUGS.map((slug) => ({ slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!CLAUDE_TOOLS_AD_SLUGS.includes(slug as ClaudeToolsAdSlug)) notFound();
  return <ClaudeToolsAdLandingPage config={getClaudeToolsAdConfig(slug as ClaudeToolsAdSlug)} />;
}
