import Image from "next/image";
import { cn } from "@/lib/utils";

// Shared responsive brand standard used by website-static and the console:
// mark + lowercase "flatkey" in Public Sans Bold, with no ".ai" suffix.
const FLATKEY_MARK = "/flatkey-mark.svg";

const WORDMARK_FONT_FAMILY = "'Public Sans', Inter, -apple-system, sans-serif";

type FlatkeyBrandLogoProps = {
  alt?: string;
  className?: string;
};

export function FlatkeyBrandLogo({
  alt = "flatkey",
  className,
}: FlatkeyBrandLogoProps) {
  return (
    <span
      data-flatkey-brand="lockup"
      aria-label={alt}
      className={cn(
        "inline-flex shrink-0 items-center gap-[9px] min-[901px]:gap-2 min-[1481px]:gap-[9px]",
        className
      )}
    >
      <Image
        src={FLATKEY_MARK}
        alt=""
        aria-hidden
        width={40}
        height={40}
        className="h-[38px] w-[38px] shrink-0 min-[901px]:h-9 min-[901px]:w-9 min-[1481px]:h-10 min-[1481px]:w-10"
      />
      <span
        data-flatkey-wordmark="true"
        className="text-[30px] leading-none font-bold text-[#0B0B0F] min-[901px]:text-[28px] min-[1481px]:text-[32px] dark:text-[#F5F5F2] max-[420px]:hidden"
        style={{ fontFamily: WORDMARK_FONT_FAMILY, letterSpacing: "-0.043em" }}
      >
        flatkey
      </span>
    </span>
  );
}
