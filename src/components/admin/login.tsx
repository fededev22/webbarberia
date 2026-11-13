"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function LoginForm({ showHint }: { showHint: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState(showHint ? "admin@solera.example" : "")
  const [password, setPassword] = useState(showHint ? "Solera.2026" : "")
  const [code, setCode] = useState("")
  const [need, setNeed] = useState(false)
  const [error, setError] = useState("")
  return (
    <main className="login">
      <form onSubmit={async (e) => {
        e.preventDefault()
        setError("")
        const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, code }) })
        const json = await res.json()
        if (json.needTotp) { setNeed(true); return }
        if (!res.ok) { setError(json.error || "No se pudo entrar"); return }
        router.refresh()
      }}>
        <p className="eyebrow">Escritorio</p>
        <h1 className="display" style={{ fontSize: 56, marginTop: 0 }}>Entrar</h1>
        <label className="field">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="field">Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {need && <label className="field">Código de la app<input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required /></label>}
        {error && <p className="warn">{error}</p>}
        <button className="btn btn-gold" type="submit">Entrar</button>
        {showHint && <p className="muted">Demo local: admin@solera.example · Solera.2026. Cambiala en Ajustes.</p>}
      </form>
    </main>
  )
}
