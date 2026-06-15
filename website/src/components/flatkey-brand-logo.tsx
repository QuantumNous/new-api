import Image from "next/image";
import { cn } from "@/lib/utils";

const FLATKEY_LOGO_LIGHT = "/flatkey-logo-light.png";
const FLATKEY_LOGO_DARK_BG = "/flatkey-logo-dark-bg.png";

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
          src={FLATKEY_LOGO_LIGHT}
          alt={alt}
          width={1024}
          height={1024}
          className={cn(imageClass, "block dark:hidden")}
        />
        <Image
          src={FLATKEY_LOGO_DARK_BG}
          alt={alt}
          width={1024}
          height={1024}
          className={cn(imageClass, "hidden dark:block")}
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className="relative h-8 w-14 shrink-0 overflow-hidden">
        <span
          aria-hidden
          className="absolute inset-0 block bg-no-repeat dark:hidden"
          style={{
            backgroundImage: `url(${FLATKEY_LOGO_LIGHT})`,
            backgroundPosition: "50% 32%",
            backgroundSize: "170%",
          }}
        />
        <span
          aria-hidden
          className="absolute inset-0 hidden bg-no-repeat dark:block"
          style={{
            backgroundImage: `url(${FLATKEY_LOGO_DARK_BG})`,
            backgroundPosition: "50% 32%",
            backgroundSize: "170%",
          }}
        />
      </span>
      <span className="bg-gradient-to-r from-slate-950 via-violet-950 to-violet-700 bg-clip-text text-[20px] leading-none font-bold tracking-[-0.01em] text-transparent dark:from-white dark:via-violet-100 dark:to-violet-300">
        flatkey
      </span>
    </span>
  );
}
