import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://og-image-edge.vercel.app"),
  title: "OGForge — Dynamic Open Graph Images on the Edge",
  description:
    "Generate real, edge-rendered Open Graph preview images on the fly with @vercel/og + Satori. Multiple templates, themes, and a live demo.",
  openGraph: {
    title: "OGForge — Dynamic Open Graph Images on the Edge",
    description:
      "Generate real, edge-rendered Open Graph preview images on the fly with @vercel/og + Satori.",
    images: [
      "/api/og?title=OGForge&subtitle=Dynamic+Open+Graph+images+on+the+Edge+Runtime&template=product&theme=dark",
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
