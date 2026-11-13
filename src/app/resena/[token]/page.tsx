"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>()
  const [info, setInfo] = useState<{ name: string; barber: string; done: boolean } | null>(null)
  const [rating, setRating] = useState(5)
  const [text, setText] = useState("")
  const [msg, setMsg] = useState("")
  useEffect(() => {
    fetch(`/api/reviews/${token}`).then((r) => r.json()).then(setInfo)
  }, [token])
  if (!info) return <main className="wrap" style={{ padding: 32 }}><p>…</p></main>
  if (info.done || msg) return <main className="wrap" style={{ padding: 32 }}><h1 className="display">Gracias, {info.name}.</h1><p>La reseña quedó guardada.</p></main>
  return (
    <main className="wrap" style={{ padding: 32, maxWidth: 640 }}>
      <p className="eyebrow">{info.barber}</p>
      <h1 className="display" style={{ fontSize: 56 }}>¿Cómo quedó?</h1>
      <form onSubmit={async (e) => {
        e.preventDefault()
        const res = await fetch(`/api/reviews/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating, text }) })
        const json = await res.json()
        setMsg(res.ok ? "ok" : json.error)
      }}>
        <div className="filters">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={`chip ${rating === n ? "on" : ""}`} onClick={() => setRating(n)}>{n}</button>)}</div>
        <label className="field">Contanos en una frase<textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} /></label>
        <button className="btn btn-gold" type="submit">Enviar reseña</button>
        {msg && msg !== "ok" && <p className="warn">{msg}</p>}
      </form>
    </main>
  )
}
