import type { Metadata, Viewport } from "next"
import { Fraunces, Outfit } from "next/font/google"
import { cookies } from "next/headers"
import "./globals.css"
import { Providers } from "@/components/site/providers"

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" })
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "Solera · Barbería en Palermo", template: "%s · Solera" },
  description: "Barbería de cuatro sillas en Thames, Palermo. Cortes, barba, color y turnos en tres pasos. Anotamos el peine para que el próximo corte salga igual.",
  openGraph: {
    title: "Solera · Barbería en Palermo",
    description: "Cuatro sillas en Thames. Reservá un corte, una barba o los dos.",
    locale: "es_AR",
    type: "website",
  },
  alternates: { canonical: "/" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0b0a" },
    { media: "(prefers-color-scheme: light)", color: "#f3eee4" },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const theme = jar.get("solera-theme")?.value === "light" ? "light" : "dark"
  const lang = jar.get("solera-lang")?.value === "en" ? "en" : "es"
  return (
    <html lang={lang} data-theme={theme} className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body>
        <Providers initialLang={lang} initialTheme={theme}>{children}</Providers>
      </body>
    </html>
  )
}
