"use client";

import Image from "next/image";

interface ThemedImageProps {
  lightSrc: string;
  darkSrc: string;
  alt: string;
  className?: string;
}

export function ThemedImage({ lightSrc, darkSrc, alt, className }: ThemedImageProps) {
  return (
    <div className={`relative ${className || ""}`}>
      {/* Light mode image */}
      <Image
        className="block dark:hidden"
        alt={alt}
        src={lightSrc}
        width={800}
        height={400}
        quality={100}
        style={{ height: "auto", width: "100%" }}
      />
      
      {/* Dark mode image */}
      <Image
        className="hidden dark:block"
        alt={alt}
        src={darkSrc}
        width={800}
        height={400}
        quality={100}
        style={{ height: "auto", width: "100%" }}
      />
    </div>
  );
}
