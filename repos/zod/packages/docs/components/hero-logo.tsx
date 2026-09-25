"use client";

import Image from "next/image";
import { useState } from "react";

interface HeroLogoProps {
  className?: string;
}

export function HeroLogo({ className }: HeroLogoProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`relative ${className || ""}`} style={{ height: "170px" }}>
      <Image
        className={`block dark:hidden mx-auto my-0! transition-opacity duration-500 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        alt="Zod logo"
        src="/logo/logo-glow.png"
        width={200}
        height={170}
        priority
        quality={100}
        onLoad={() => setIsLoaded(true)}
        style={{ height: "100%", width: "auto" }}
      />

      <Image
        className={`hidden dark:block mx-auto my-0! transition-opacity duration-500 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        alt="Zod logo"
        src="/logo/logo-glow.png"
        width={200}
        height={170}
        priority
        quality={100}
        onLoad={() => setIsLoaded(true)}
        style={{ height: "100%", width: "auto" }}
      />
    </div>
  );
}
