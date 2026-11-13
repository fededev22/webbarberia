"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { Appointment, Barber, Block, Campaign, Coupon, Customer, MessageLog, Product, Review, Service, Settings, Template, WaitlistEntry } from "@/lib/types"

export type AdminData = {
  settings: Settings
  services: Service[]
  products: Product[]
  barbers: Barber[]
  appointments: Appointment[]
  customers: (Customer & { segment: string; due: boolean })[]
  reviews: Review[]
  waitlist: WaitlistEntry[]
  coupons: Coupon[]
  campaigns: (Campaign & { stats: { sent: number; opened: number; bookings: number } })[]
  templates: Template[]
  blocks: Block[]
  messages: MessageLog[]
  dashboard: {
    today: Appointment[]
    income: { today: number; week: number; month: number; expectedToday: number }
    clients: { fresh: number; returning: number }
    top: { name: string; count: number }[]
    hours: { hour: number; count: number }[]
    weekSeries: { day: string; total: number }[]
    cancelRate: number
    noshowRate: number
    occupancy: { percent: number }
    gaps: { barber: string; from: string; to: string }[]
    due: { id: string; name: string; phone: string }[]
    commissions: { name: string; earned: number; commission: number }[]
    segments: Record<string, number>
  }
  integrations: { email: boolean; whatsapp: boolean; supabase: boolean }
  admin: { email: string; totpEnabled: boolean }[]
  qr?: string
  otpauth?: string
}

type Api = {
  data: AdminData | null
  error: string
  act: (action: string, payload?: Record<string, unknown>) => Promise<AdminData>
}

const Ctx = createContext<Api | null>(null)

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    fetch("/api/admin").then(async (r) => {
      const json = await r.json()
      if (!r.ok) setError(json.error || "Error")
      else setData(json)
    })
  }, [])
  async function act(action: string, payload: Record<string, unknown> = {}) {
    const res = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload }) })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || "Error")
    setData(json)
    return json as AdminData
  }
  return <Ctx.Provider value={{ data, error, act }}>{children}</Ctx.Provider>
}

export function useAdmin() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("admin")
  return ctx
}
