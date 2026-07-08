import { HomeSupport } from "@/components/home-support";
import { SiteShell } from "@/components/site-shell";
import { getHomeCopy } from "@/lib/home-copy";
import type { Locale } from "@/lib/locales";

type Props = {
  locale: Locale;
};

// Dedicated contact page: same support content as the homepage support screen
// (email / live chat / SMS), reachable from the top navigation.
export function ContactPage(props: Props) {
  const home = getHomeCopy(props.locale);
  return (
    <SiteShell locale={props.locale} pathname="/contact">
      <main className="relative overflow-x-hidden pt-16">
        <HomeSupport copy={home.support} />
      </main>
    </SiteShell>
  );
}
