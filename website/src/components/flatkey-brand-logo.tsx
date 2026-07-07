import Image from "next/image";
import { cn } from "@/lib/utils";

// Brand v5 (design doc "Flatkey Logo 方案" card 5a): gradient shield-key mark +
// single-color "flatkey.ai" wordmark in Space Grotesk SemiBold, lowercase.
// Wordmark color is #1E1B4B on light, near-white on dark — no gradient text.
const FLATKEY_LOCKUP_LIGHT = "/flatkey-lockup-light.svg";
const FLATKEY_LOCKUP_DARK = "/flatkey-lockup-dark.svg";
const FLATKEY_MARK = "/flatkey-mark.svg";

const WORDMARK_FONT_FAMILY = "'Space Grotesk', Inter, 'SF Pro Display', Arial, sans-serif";

type FlatkeyBrandLogoProps = {
  alt?: string;
  className?: string;
  imageClassName?: string;
  variant?: "lockup" | "full";
};

export function FlatkeyBrandLogo({
  alt = "Flatkey",
  className,
  imageClassName,
  variant = "lockup",
}: FlatkeyBrandLogoProps) {
  const imageClass = cn("h-full w-full object-contain", imageClassName);

  if (variant === "full") {
    return (
      <span className={cn("relative block overflow-hidden", className)}>
        <Image
          src={FLATKEY_LOCKUP_LIGHT}
          alt={alt}
          width={250}
          height={64}
          className={cn(imageClass, "block dark:hidden")}
        />
        <Image
          src={FLATKEY_LOCKUP_DARK}
          alt={alt}
          width={250}
          height={64}
          className={cn(imageClass, "hidden dark:block")}
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image src={FLATKEY_MARK} alt="" aria-hidden width={32} height={32} className="h-8 w-8 shrink-0" />
      <span
        className="text-[20px] leading-none font-semibold text-[#1E1B4B] dark:text-slate-50"
        style={{ fontFamily: WORDMARK_FONT_FAMILY }}
      >
        flatkey.ai
      </span>
    </span>
  );
}
