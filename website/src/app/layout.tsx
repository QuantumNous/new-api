import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "flatkey.ai",
  title: {
    default: "flatkey.ai",
    template: "%s | flatkey.ai",
  },
};

export default function RootLayout(props: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  );
}
