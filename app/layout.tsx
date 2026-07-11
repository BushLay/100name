import localFont from "next/font/local"
import type { Metadata } from "next"

import "./globals.css"
import { SiteChrome } from "@/components/SiteChrome"
import { ThemeProvider } from "@/components/theme-provider"
import { getSiteMetadataBase } from "@/lib/site"
import { cn } from "@/lib/utils"

const geist = localFont({
  src: [
    {
      path: "./fonts/geist-sans-latin.woff2",
      style: "normal",
      weight: "100 900",
    },
    {
      path: "./fonts/geist-sans-latin-ext.woff2",
      style: "normal",
      weight: "100 900",
    },
  ],
  display: "swap",
  variable: "--font-sans",
})

const fontMono = localFont({
  src: [
    {
      path: "./fonts/geist-mono-latin.woff2",
      style: "normal",
      weight: "100 900",
    },
    {
      path: "./fonts/geist-mono-latin-ext.woff2",
      style: "normal",
      weight: "100 900",
    },
  ],
  display: "swap",
  variable: "--font-mono",
})

export const metadata: Metadata = {
  metadataBase: getSiteMetadataBase(),
  title: {
    default: "Name 100",
    template: "%s | Name 100",
  },
  description: "A Wikidata-powered daily women name challenge with share and SEO support.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Name 100",
    description:
      "Play a deterministic daily women name challenge, finish 100 answers, and share your result.",
    type: "website",
    siteName: "Name 100",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider>
          <SiteChrome>{children}</SiteChrome>
        </ThemeProvider>
      </body>
    </html>
  )
}
