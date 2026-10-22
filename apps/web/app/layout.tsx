import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Inter, JetBrains_Mono, Literata } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/site-header";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const literata = Literata({
  subsets: ["latin"],
  variable: "--font-read",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const dyslexic = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-dyslexia",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "lekh — read, write, belong",
    template: "%s · lekh",
  },
  description:
    "lekh is a calm home for stories: write with a proper editor, publish in your own language, and read without ads.",
  applicationName: "lekh",
  openGraph: {
    title: "lekh",
    description: "Read. Write. Belong.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#17181c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${literata.variable} ${mono.variable} ${dyslexic.variable}`}>
      <body className="min-h-dvh bg-background font-sans antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
          <SiteHeader />
          <main className="flex-1 pb-24 md:pb-0">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
