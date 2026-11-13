"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { Catalog } from "@/lib/catalog"
import { addDays, money, minutesLabel } from "@/lib/time"
import { useUi } from "./providers"

type Slot = {
  start: string
  end: string
  barberId: string
  secondBarberId?: string
  duoMode?: "parallel" | "sequential"
  golden: boolean
  label: string
  barberName: string
  secondName: string
}

export function Booking({ data, rainy, initialService, initialBarber, camp }: { data: Catalog; rainy: boolean; initialService?: string; initialBarber?: string; camp?: string }) {
  const { t, lang } = useUi()
  const [step, setStep] = useState(1)
  const [services, setServices] = useState<string[]>(initialService && data.services.some((s) => s.id === initialService) ? [initialService] : [])
  const [duo, setDuo] = useState(false)
  const [duoName, setDuoName] = useState("")
  const [barber, setBarber] = useState(initialBarber || "any")
  const [date, setDate] = useState(data.today)
  const [slots, setSlots] = useState<Slot[]>([])
  const [slot, setSlot] = useState<Slot | null>(null)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [coupon, setCoupon] = useState("")
  const [referral, setReferral] = useState("")
  const [products, setProducts] = useState<Record<string, number>>({})
  const [consent, setConsent] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [whatsapp, setWhatsapp] = useState(true)
  const [quote, setQuote] = useState<{ total: number; discount: number; reason: string; minutes: number } | null>(null)
  const [error, setError] = useState("")
  const [done, setDone] = useState<{ token: string; when: string; total: number; google: string; barbers: string[] } | null>(null)
  const [waitOk, setWaitOk] = useState(false)
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(data.today, i)), [data.today])

  function toggle(id: string) {
    setServices((curr) => curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id])
    setSlot(null)
  }

  useEffect(() => {
    if (!services.length) { setSlots([]); return }
    const ctrl = new AbortController()
    setLoading(true)
    const q = new URLSearchParams({ date, services: services.join(","), barber, duo: duo ? "1" : "0" })
    fetch(`/api/availability?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((json) => setSlots(json.slots || []))
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [date, services, barber, duo])

  useEffect(() => {
    if (step !== 3 || !slot) return
    const ctrl = new AbortController()
    fetch("/api/quote", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceIds: services,
        start: slot.start,
        barberId: slot.barberId,
        duo,
        phone,
        coupon,
        products: Object.entries(products).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ id, qty })),
      }),
    }).then(async (r) => {
      const json = await r.json()
      if (r.ok) setQuote(json)
      else setError(json.error || "")
    }).catch(() => {})
    return () => ctrl.abort()
  }, [step, slot, services, duo, phone, coupon, products])

  async function book() {
    setError("")
    if (!consent) { setError(t("Necesitamos tu consentimiento para guardar el turno.", "We need consent to store the booking.")); return }
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceIds: services, barberId: slot?.barberId, secondBarberId: slot?.secondBarberId, duoMode: slot?.duoMode,
        start: slot?.start, duo, duoName, name, email, phone, coupon, referralCode: referral, campaignId: camp,
        marketingOptIn: marketing, whatsappOptIn: whatsapp,
        products: Object.entries(products).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ id, qty })),
        company: (document.getElementById("company") as HTMLInputElement | null)?.value || "",
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || t("No se pudo reservar.", "Could not book.")); return }
    setDone(json)
  }

  async function waitlist() {
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serviceIds: services, barberId: barber, name, email, phone, date }),
    })
    const json = await res.json()
    if (!res.ok) setError(json.error || "")
    else setWaitOk(true)
  }

  if (done) {
    return (
      <div className="wrap" style={{ padding: "48px 0" }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <p className="eyebrow">{t("Listo", "Booked")}</p>
          <h1 className="display" style={{ fontSize: "clamp(48px, 8vw, 84px)" }}>{t("Ahí quedó la silla.", "The chair is yours.")}</h1>
          <p>{done.when} · {done.barbers?.join(" + ")}</p>
          <p className="price">{money(done.total || 0)}</p>
          <p className="muted">{t("Te mandamos el email de confirmación. Si no hay clave de correo cargada, el mensaje queda en el panel.", "We sent the confirmation. Without an email key, it is stored in the desk.")}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a className="btn btn-gold" href={done.google}>{t("Agregar a Google Calendar", "Add to Google Calendar")}</a>
            <a className="btn" href={`/api/bookings/${done.token}/calendar`}>{t("Archivo para Apple", "Apple calendar file")}</a>
            <a className="btn" href={`/turno/${done.token}`}>{t("Cancelar o cambiar", "Cancel or move")}</a>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="wrap" style={{ padding: "32px 0 48px", maxWidth: 760 }}>
      <p className="eyebrow">{t("Tres pasos", "Three steps")}</p>
      <h1 className="display" style={{ fontSize: "clamp(42px, 7vw, 72px)" }}>{t("Agendar turno", "Book a chair")}</h1>
      {rainy && <p className="banner">{t("Está lloviendo en Palermo. Entre las 14 y las 17 hay un descuento de lluvia si no gana otro premio.", "It's raining in Palermo. Between 2 and 5 pm a rain discount applies unless a better reward wins.")}</p>}
      <div className="steps" aria-hidden>{[1, 2, 3].map((n) => <span key={n} className={n <= step ? "on" : ""} />)}</div>
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {data.services.filter((s) => s.active).map((s) => (
              <label key={s.id} className="check" style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
                <input type="checkbox" checked={services.includes(s.id)} onChange={() => toggle(s.id)} />
                <span style={{ flex: 1 }}><b>{lang === "en" ? s.nameEn : s.name}</b> · {minutesLabel(s.durationMin)}<br /><span className="muted">{lang === "en" ? s.descriptionEn : s.description}</span></span>
                <b className="price">{money(s.promoPrice && s.promoUntil && new Date(s.promoUntil) > new Date() ? s.promoPrice : s.price)}</b>
              </label>
            ))}
            <label className="check"><input type="checkbox" checked={duo} onChange={(e) => setDuo(e.target.checked)} /> {t("Vengo con alguien. Buscamos dos sillas a la misma hora.", "I'm bringing someone. Find two chairs at the same time.")}</label>
            <button className="btn btn-gold" type="button" disabled={!services.length} onClick={() => setStep(2)}>{t("Elegir horario", "Pick a time")}</button>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="filters">
              <button type="button" className={`chip ${barber === "any" ? "on" : ""}`} onClick={() => { setBarber("any"); setSlot(null) }}>{t("Cualquiera", "Anyone")}</button>
              {data.barbers.filter((b) => b.active).map((b) => (
                <button key={b.id} type="button" className={`chip ${barber === b.id ? "on" : ""}`} onClick={() => { setBarber(b.id); setSlot(null) }}>{b.name.split(" ")[0]}</button>
              ))}
            </div>
            <div className="filters">
              {days.map((day) => (
                <button key={day} type="button" className={`chip ${date === day ? "on" : ""}`} onClick={() => { setDate(day); setSlot(null) }}>{day.slice(8)}/{day.slice(5, 7)}</button>
              ))}
            </div>
            {loading && <p className="muted">{t("Mirando la agenda…", "Checking the book…")}</p>}
            <div className="slots">
              {slots.map((item) => (
                <button key={item.start + item.barberId} type="button" className={`btn slot ${slot?.start === item.start ? "btn-gold" : ""}`} onClick={() => setSlot(item)}>
                  {item.label}{item.golden ? " · " + t("dorada", "gold") : ""}
                </button>
              ))}
            </div>
            {slot && <p className="muted">{slot.barberName}{slot.secondName ? ` + ${slot.secondName}` : ""}{slot.duoMode === "sequential" ? t(" · uno después del otro", " · back to back") : ""}</p>}
            {!loading && services.length > 0 && slots.length === 0 && (
              <form onSubmit={(e) => { e.preventDefault(); waitlist() }}>
                <p>{t("Ese día no hay hueco. Dejá el teléfono y te avisamos si se libera.", "Nothing open that day. Leave a number and we'll ping you if one frees up.")}</p>
                <label className="field">{t("Nombre", "Name")}<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
                <label className="field">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                <label className="field">{t("Teléfono", "Phone")}<input value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
                <button className="btn" type="submit">{t("Anotarme en la lista", "Join the waitlist")}</button>
                {waitOk && <p>{t("Quedaste en la lista.", "You're on the list.")}</p>}
              </form>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="btn" type="button" onClick={() => setStep(1)}>{t("Volver", "Back")}</button>
              <button className="btn btn-gold" type="button" disabled={!slot} onClick={() => setStep(3)}>{t("Mis datos", "My details")}</button>
            </div>
          </motion.div>
        )}
        {step === 3 && (
          <motion.form key="s3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={(e) => { e.preventDefault(); book() }}>
            <label className="field">{t("Nombre", "Name")}<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
            <label className="field">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label className="field">{t("Teléfono", "Phone")}<input value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
            {duo && <label className="field">{t("Nombre de quien viene con vos", "Name of the person with you")}<input value={duoName} onChange={(e) => setDuoName(e.target.value)} required /></label>}
            <label className="field">{t("Cupón", "Coupon")}<input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="BIENVENIDA" /></label>
            <label className="field">{t("Código de un amigo", "A friend's code")}<input value={referral} onChange={(e) => setReferral(e.target.value)} /></label>
            <p>{t("Para llevar", "To take home")}</p>
            {data.products.map((p) => (
              <label key={p.id} className="check">
                <input type="checkbox" checked={(products[p.id] || 0) > 0} onChange={(e) => setProducts({ ...products, [p.id]: e.target.checked ? 1 : 0 })} />
                {lang === "en" ? p.nameEn : p.name} · {money(p.price)}
              </label>
            ))}
            <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required /> {t("Acepto que guarden mi nombre, email y teléfono para este turno y sus recordatorios.", "I agree you store my name, email and phone for this booking and its reminders.")}</label>
            <label className="check"><input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} /> {t("Avisame también por WhatsApp.", "Also message me on WhatsApp.")}</label>
            <label className="check"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> {t("Quiero novedades. Me puedo dar de baja en cada mensaje.", "Send me news. I can opt out from every message.")}</label>
            <input id="company" name="company" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: -9999 }} aria-hidden />
            {quote && <p>{quote.reason ? `${quote.reason} · -${money(quote.discount)} · ` : ""}<b>{money(quote.total)}</b> · {minutesLabel(quote.minutes)}{duo ? " ×2" : ""}</p>}
            {error && <p className="warn">{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" type="button" onClick={() => setStep(2)}>{t("Volver", "Back")}</button>
              <button className="btn btn-gold" type="submit">{t("Confirmar turno", "Confirm")}</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
