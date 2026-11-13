import { Home } from "@/components/site/home"
import { Shell } from "@/components/site/shell"
import { catalog } from "@/lib/catalog"
import { isRainy } from "@/lib/weather"

export const dynamic = "force-dynamic"

export default async function Page() {
  const data = await catalog()
  const rainy = await isRainy()
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: data.settings.name,
    description: data.settings.tagline,
    address: {
      "@type": "PostalAddress",
      streetAddress: data.settings.street,
      addressLocality: data.settings.district,
      addressRegion: "Buenos Aires",
      addressCountry: "AR",
    },
    email: data.settings.email,
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "10:00", closes: "20:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "10:00", closes: "18:00" },
    ],
    makesOffer: data.services.filter((s) => s.active).map((s) => ({ "@type": "Offer", name: s.name, price: s.price, priceCurrency: "ARS" })),
  }
  return (
    <Shell data={data}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Home data={data} rainy={rainy} />
    </Shell>
  )
}
