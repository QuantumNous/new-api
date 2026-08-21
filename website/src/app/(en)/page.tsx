import { cookies } from "next/headers";
import { OnlineHomePage } from "@/components/online-home-page";
import { AmplitudeHomePageTracker } from "@/components/amplitude-home-page-tracker";
import { hasConsoleSessionHintFromRequestCookieStore } from "@/lib/console-session-hint";
import { buildMetadata, HOMEPAGE_SOCIAL_IMAGE } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "flatkey - One key. More models. More tools. Lower costs.",
  description:
    "flatkey routes your requests to official GPT, Claude, Gemini, DeepSeek, Qwen and GLM APIs, with 100+ frontier models and 1,000+ AI tools behind one key.",
  pathname: "/",
  image: HOMEPAGE_SOCIAL_IMAGE,
});

export default async function Page() {
  const requestCookies = await cookies();
  return (
    <>
      <AmplitudeHomePageTracker />
      <OnlineHomePage
        hasConsoleSessionHint={hasConsoleSessionHintFromRequestCookieStore(
          requestCookies,
        )}
        locale="en"
      />
    </>
  );
}
