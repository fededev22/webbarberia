"use client"

import { useState } from "react"
import Link from "next/link"
import { Shell } from "./shell"
import { useUi } from "./providers"
import type { Catalog } from "@/lib/catalog"
import { formatDay, money } from "@/lib/time"

type Ficha = {
  customer: { name: string; stamps: number; recipe: string; referralCode: string }
  visits: { when: string; services: string; barber: string; total: number }[]
  tenth: number
  second: number
}

export function Ficha({ data }: { data: Catalog }) {
  const { t } = useUi()
  const [phone, setPhone] = useState("")
  const [card, setCard] = useState<Ficha | null>(null)
  const [error, setError] = useState("")
  const next = card ? (card.customer.stamps === 1 ? card.second : (card.customer.stamps + 1) % 10 === 0 ? card.tenth : 0) : 0
  return (
    <Shell data={data}>
      <div className="wrap" style={{ padding: "36px 0", maxWidth: 720 }}>
        <p className="eyebrow">{t("Ficha", "Card")}</p>
        <h1 className="display" style={{ fontSize: "clamp(42px, 7vw, 72px)" }}>{t("Tu corte, sin cuenta.", "Your cut, no account.")}</h1>
        <form onSubmit={async (e) => {
          e.preventDefault()
          setError("")
          const res = await fetch(`/api/loyalty?phone=${encodeURIComponent(phone)}`)
          const json = await res.json()
          if (!res.ok) setError(json.error || "")
          else setCard(json)
        }}>
          <label className="field">{t("Teléfono con el que reservás", "Phone you book with")}<input value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
          <button className="btn btn-gold" type="submit">{t("Ver ficha", "Show card")}</button>
        </form>
        {error && <p className="warn">{error}</p>}
        {card && (
          <div style={{ marginTop: 24 }}>
            <h2 className="display" style={{ fontSize: 42 }}>{card.customer.name.split(" ")[0]}</h2>
            <p>{t("Sellos", "Stamps")}: {card.customer.stamps}/10 {next ? t(`· el próximo corte tiene ${next}%`, `· next cut is ${next}% off`) : ""}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Array.from({ length: 10 }, (_, i) => <span key={i} className="chip" style={{ background: i < (card.customer.stamps % 10 || (card.customer.stamps ? 10 : 0)) ? "var(--gold)" : "transparent", color: i < (card.customer.stamps % 10 || (card.customer.stamps ? 10 : 0)) ? "#1a1208" : "inherit" }}>{i + 1}</span>)}
            </div>
            <p>{t("Receta", "Recipe")}: {card.customer.recipe || t("Todavía no hay receta. El barbero la anota después del corte.", "No recipe yet. The barber writes it after the cut.")}</p>
            <p>{t("Invitá con", "Share")} <b>{card.customer.referralCode}</b>. {t("Cuando tu invitado completa el primer corte, sumás un sello.", "When they finish a first cut, you get a stamp.")}</p>
            <ul>
              {card.visits.map((v) => <li key={v.when}>{formatDay(v.when, data.settings.timezone)} · {v.services} · {v.barber} · {money(v.total)}</li>)}
            </ul>
            <Link className="btn" href="/agendar">{t("Reservar el próximo", "Book the next one")}</Link>
          </div>
        )}
      </div>
    </Shell>
  )
}
