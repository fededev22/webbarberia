"use client"

import { useState } from "react"
import { useParams } from "next/navigation"

export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>()
  const [msg, setMsg] = useState("")
  return (
    <main className="wrap" style={{ padding: 32, maxWidth: 640 }}>
      <h1 className="display" style={{ fontSize: 56 }}>Baja de mensajes</h1>
      <p>Dejás de recibir campañas y recordatorios comerciales. El turno que ya tengas sigue en la agenda.</p>
      <button className="btn btn-gold" type="button" onClick={async () => {
        const res = await fetch("/api/baja", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
        setMsg(res.ok ? "Listo. No te escribimos más por novedades." : "No encontramos esa baja.")
      }}>Confirmar baja</button>
      {msg && <p>{msg}</p>}
    </main>
  )
}
