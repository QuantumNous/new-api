import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import "lenis/dist/lenis.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  weight: "variable",
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  fallback: ["PingFang SC", "Microsoft YaHei", "Arial", "sans-serif"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HelloCoder",
  description:
    "通过统一接口连接主流AI大模型，自费正价PRO20x账号，GPT系列低至0.06x，Claude低至0.6x，为VibeCoding助力",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-xl bg-neutral-950 px-4 py-2 font-semibold text-white shadow-lg transition-transform focus:translate-y-0 focus-visible:ring-3 focus-visible:ring-blue-500/40 focus-visible:outline-none"
        >
          跳至主要内容
        </a>
        {children}
      </body>
    </html>
  );
}
