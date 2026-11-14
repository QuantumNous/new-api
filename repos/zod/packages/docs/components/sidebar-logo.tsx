"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export function SidebarLogo({ src, alt, width = 24, height = 24, className = "h-5" }: ImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="relative" style={{ width: `${width}px`, height: `${height}px` }}>
      <Image
        className={`transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"} ${className}`}
        alt={alt}
        src={src}
        width={width}
        height={height}
        quality={100}
        onLoad={() => setIsLoaded(true)}
        style={{ width: "auto", height: "100%" }}
      />
    </div>
  );
}
