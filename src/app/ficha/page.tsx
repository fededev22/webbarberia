import { Ficha } from "@/components/site/ficha"
import { catalog } from "@/lib/catalog"

export const dynamic = "force-dynamic"

export default async function Page() {
  return <Ficha data={await catalog()} />
}
