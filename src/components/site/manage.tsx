"use client"

import { useEffect, useState } from "react"
import { Shell } from "./shell"
import { useUi } from "./providers"
import type { Catalog } from "@/lib/catalog"
import { addDays, money } from "@/lib/time"

type Info = { status: string; when: string; services: string; serviceIds: string[]; barbers: string[]; duo: boolean; total: number; cancelHours: number; name: string }
type Slot = { start: string; label: string; barberId: string; secondBarberId?: string; duoMode?: "parallel" | "sequential"; barberName: string }

export function Manage({ data, token }: { data: Catalog; token: string }) {
  const { t } = useUi()
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState("")
  const [date, setDate] = useState(data.today)
  const [slots, setSlots] = useState<Slot[]>([])
  const [done, setDone] = useState("")
  useEffect(() => {
    fetch(`/api/bookings/${token}`).then(async (r) => {
      const json = await r.json()
      if (!r.ok) setError(json.error || "")
      else setInfo(json)
    })
  }, [token])
  useEffect(() => {
    if (!info) return
    const q = new URLSearchParams({ date, services: info.serviceIds.join(","), barber: "any", duo: info.duo ? "1" : "0" })
    fetch(`/api/availability?${q}`).then((r) => r.json()).then((json) => setSlots(json.slots || []))
  }, [info, date])
  if (error) return <Shell data={data}><div className="wrap"><p>{error}</p></div></Shell>
  if (!info) return <Shell data={data}><div className="wrap"><p>{t("Buscando el turno…", "Finding the booking…")}</p></div></Shell>
  return (
    <Shell data={data}>
      <div className="wrap" style={{ padding: "36px 0", maxWidth: 720 }}>
        <p className="eyebrow">{info.name}</p>
        <h1 className="display" style={{ fontSize: "clamp(40px, 6vw, 68px)" }}>{info.services}</h1>
        <p>{info.when} · {info.barbers.join(" + ")} · {money(info.total)}</p>
        <p className="muted">{t("Estado", "Status")}: {info.status}. {t(`Podés cancelar cuando quieras. Con menos de ${info.cancelHours} h queda como tardía y la silla se ofrece a la lista de espera.`, `You can cancel anytime. Under ${info.cancelHours} h it is marked late and the chair is offered to the waitlist.`)}</p>
        {done && <p className="banner">{done}</p>}
        {info.status === "confirmed" && (
          <>
            <button className="btn btn-hot" type="button" onClick={async () => {
              const res = await fetch(`/api/bookings/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) })
              const json = await res.json()
              if (!res.ok) setError(json.error || "")
              else { setInfo({ ...info, status: "cancelled" }); setDone(json.late ? t("Cancelado tarde. La silla ya se ofreció.", "Cancelled late. The chair was offered on.") : t("Cancelado.", "Cancelled.")) }
            }}>{t("Cancelar turno", "Cancel booking")}</button>
            <h2>{t("Cambiar horario", "Move it")}</h2>
            <div className="filters">
              {Array.from({ length: 10 }, (_, i) => addDays(data.today, i)).map((day) => (
                <button key={day} className={`chip ${date === day ? "on" : ""}`} type="button" onClick={() => setDate(day)}>{day.slice(8)}/{day.slice(5, 7)}</button>
              ))}
            </div>
            <div className="slots">
              {slots.map((slot) => (
                <button key={slot.start} className="btn slot" type="button" onClick={async () => {
                  const res = await fetch(`/api/bookings/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reschedule", slot }) })
                  const json = await res.json()
                  if (!res.ok) setError(json.error || "")
                  else setDone(`${t("Nuevo horario", "New time")}: ${json.when}`)
                }}>{slot.label}</button>
              ))}
            </div>
            <p><a href={`/api/bookings/${token}/calendar`}>{t("Bajar el archivo de calendario", "Download the calendar file")}</a></p>
          </>
        )}
      </div>
    </Shell>
  )
}
