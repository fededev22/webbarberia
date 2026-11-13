import { Booking } from "@/components/site/booking"
import { Shell } from "@/components/site/shell"
import { catalog } from "@/lib/catalog"
import { isRainy } from "@/lib/weather"

export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ servicio?: string; barbero?: string; camp?: string }> }) {
  const params = await searchParams
  const data = await catalog()
  const rainy = await isRainy()
  return (
    <Shell data={data}>
      <Booking data={data} rainy={rainy} initialService={params.servicio} initialBarber={params.barbero} camp={params.camp} />
    </Shell>
  )
}
