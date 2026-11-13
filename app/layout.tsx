import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { Providers } from "@/components/layout/providers";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SITE } from "@/lib/constants";
import "./globals.css";

const aspekta = localFont({
  src: "./fonts/AspektaVF.woff2",
  variable: "--font-aspekta",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: "Tokenaires, the rich list for AI tokens", template: "%s · Tokenaires" },
  description: SITE.description,
  openGraph: { siteName: SITE.name, type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={aspekta.variable} suppressHydrationWarning>
      <body>
        <Providers>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
