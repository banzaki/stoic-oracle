import type { Metadata } from "next";
import { Cormorant_Garamond, EB_Garamond, Geist } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin", "latin-ext", "greek", "greek-ext"],
  style: ["normal", "italic"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const description = "Converse with Marcus Aurelius, Seneca and Epictetus, grounded in their own words.";

export const metadata: Metadata = {
  // Absolute URLs for the share images; on Vercel the production URL is used when SITE_URL is unset.
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  title: "Stoic Oracle",
  description,
  openGraph: { title: "Stoic Oracle", description, siteName: "Stoic Oracle", type: "website" },
  twitter: { card: "summary_large_image", title: "Stoic Oracle", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${garamond.variable} ${geistSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
