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

export const metadata: Metadata = {
  title: "Stoic Oracle",
  description: "Converse with Marcus Aurelius, Seneca and Epictetus, grounded in their own words.",
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
