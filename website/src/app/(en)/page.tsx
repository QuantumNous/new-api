import { OnlineHomePage } from "@/components/online-home-page";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "flatkey - One key. More models. More tools. Lower costs.",
  description:
    "flatkey routes your requests to official GPT, Claude, Gemini, DeepSeek, Qwen and GLM APIs, with 300+ frontier models and 1,000+ AI tools behind one key.",
  pathname: "/",
});

export default function Page() {
  return <OnlineHomePage locale="en" />;
}
