import { cn } from "@/lib/utils";

type FlatkeyBrandLogoProps = {
  className?: string;
};

export function FlatkeyBrandLogo({ className }: FlatkeyBrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className="relative h-8 w-14 shrink-0 overflow-hidden">
        <span
          aria-hidden
          className="absolute inset-0 block bg-no-repeat"
          style={{
            backgroundImage: "url(/flatkey-logo-light.png)",
            backgroundPosition: "50% 32%",
            backgroundSize: "170%",
          }}
        />
      </span>
      <span className="bg-gradient-to-r from-slate-950 via-violet-950 to-violet-700 bg-clip-text text-[20px] leading-none font-bold text-transparent">
        flatkey
      </span>
    </span>
  );
}
