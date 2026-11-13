import { Quiz } from "@/components/site/quiz"
import { catalog } from "@/lib/catalog"

export const dynamic = "force-dynamic"

export default async function Page() {
  return <Quiz data={await catalog()} />
}
