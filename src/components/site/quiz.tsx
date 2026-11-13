"use client"

import { useState } from "react"
import Link from "next/link"
import { Shell } from "@/components/site/shell"
import { useUi } from "@/components/site/providers"
import type { Catalog } from "@/lib/catalog"

const FACES = ["oval", "round", "square", "long"] as const
const HAIRS = ["straight", "wavy", "curly", "thin"] as const

const ADVICE: Record<string, { service: string; es: string; en: string }> = {
  "oval-straight": { service: "corte", es: "Clásico corto. Tu cara ya tiene proporción: no la tapes.", en: "A short classic. Your face already has the proportion." },
  "round-straight": { service: "fade", es: "Fade alto. Suma altura arriba y saca volumen a los costados.", en: "A high fade. Height on top, less on the sides." },
  "square-wavy": { service: "fade", es: "Degradé con textura. La onda suaviza el ángulo de la mandíbula.", en: "A fade with texture. The wave softens the jaw." },
  "long-curly": { service: "corte", es: "Crop con raya. El flequillo corto acorta la cara.", en: "A crop with a part. A short fringe shortens the face." },
  "thin-any": { service: "perfil", es: "Perfilado y un poco de largo arriba. No hace falta rapar para que se vea prolijo.", en: "A line-up and a little length on top." },
}

function pick(face: string, hair: string) {
  if (hair === "thin") return ADVICE["thin-any"]
  return ADVICE[`${face}-${hair}`] || ADVICE[`${face}-straight`] || ADVICE["oval-straight"]
}

export function Quiz({ data }: { data: Catalog }) {
  const { t } = useUi()
  const [face, setFace] = useState("")
  const [hair, setHair] = useState("")
  const [vibe, setVibe] = useState("")
  const result = face && hair && vibe ? pick(face, hair) : null
  return (
    <Shell data={data}>
      <div className="wrap" style={{ padding: "36px 0" }}>
        <p className="eyebrow">{t("Quiz", "Quiz")}</p>
        <h1 className="display" style={{ fontSize: "clamp(42px, 7vw, 76px)" }}>{t("Elegí tu estilo.", "Pick a cut.")}</h1>
        <Question title={t("¿Cómo es tu cara?", "Face shape?")} options={FACES.map((id) => ({ id, es: { oval: "Ovalada", round: "Redonda", square: "Cuadrada", long: "Alargada" }[id], en: id }))} value={face} onChange={setFace} />
        <Question title={t("¿Cómo es el pelo?", "Hair?")} options={HAIRS.map((id) => ({ id, es: { straight: "Lacio", wavy: "Ondulado", curly: "Rizado", thin: "Fino o con entradas" }[id], en: id }))} value={hair} onChange={setHair} />
        <Question title={t("¿Cuánto lo vas a peinar?", "How much will you style it?")} options={[{ id: "low", es: "Casi nada", en: "Almost never" }, { id: "mid", es: "Un minuto", en: "A minute" }, { id: "high", es: "Me gusta peinarlo", en: "I like styling it" }]} value={vibe} onChange={setVibe} />
        {result && (
          <div className="banner">
            <p>{t(result.es, result.en)} {vibe === "low" ? t(" Pedí el mantenimiento más corto.", " Ask for the lower-maintenance version.") : ""}</p>
            <Link className="btn btn-gold" href={`/agendar?servicio=${result.service}`}>{t("Reservar este corte", "Book this cut")}</Link>
          </div>
        )}
      </div>
    </Shell>
  )
}

function Question({ title, options, value, onChange }: { title: string; options: { id: string; es: string; en: string }[]; value: string; onChange: (id: string) => void }) {
  const { lang } = useUi()
  return (
    <div style={{ margin: "18px 0" }}>
      <h2 style={{ fontSize: 22 }}>{title}</h2>
      <div className="filters">
        {options.map((o) => <button key={o.id} type="button" className={`chip ${value === o.id ? "on" : ""}`} onClick={() => onChange(o.id)}>{lang === "en" ? o.en : o.es}</button>)}
      </div>
    </div>
  )
}
