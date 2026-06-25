import { RootDocument, rootMetadata } from "@/components/root-document";
import { DEFAULT_LOCALE } from "@/lib/locales";
import "../globals.css";

export const metadata = rootMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RootDocument lang={DEFAULT_LOCALE}>{children}</RootDocument>;
}
