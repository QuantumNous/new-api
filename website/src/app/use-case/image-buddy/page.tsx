import { IMAGE_BUDDY_USE_CASE, CodingAgentUseCasePage } from "@/components/coding-agent-use-case-page";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Flatkey with Image Buddy — commercial image generation",
  description:
    "Use Image Buddy with Flatkey to generate product images, ads, avatars, app visuals, and ecommerce creatives with lower image generation cost.",
  pathname: "/use-case/image-buddy",
});

export default function Page() {
  return <CodingAgentUseCasePage config={IMAGE_BUDDY_USE_CASE} locale="en" />;
}
