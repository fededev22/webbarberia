import { liveBoard, occupancy, publicSettings } from "./engine"
import { read } from "./store"
import { todayKey } from "./time"
import type { Barber } from "./types"

export async function catalog() {
  return read((db) => ({
    services: db.services,
    products: db.products.filter((p) => p.active),
    barbers: db.barbers.map((b) => {
      const { commissionPct: _hidden, ...rest } = b
      void _hidden
      return rest as Omit<Barber, "commissionPct">
    }),
    reviews: db.reviews.filter((r) => r.published),
    settings: publicSettings(db),
    occupancy: occupancy(db),
    live: liveBoard(db),
    today: todayKey(db.settings.timezone),
  }))
}

export type Catalog = Awaited<ReturnType<typeof catalog>>
