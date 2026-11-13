import type { MessageLog, PendingMessage } from "./types"
import { uid } from "./time"

/** Envía por Resend o WhatsApp Cloud si hay claves. Si no, el mensaje queda en el registro y el flujo sigue. */
export async function deliver(message: PendingMessage, origin: string): Promise<MessageLog> {
  const id = uid("msg")
  const html = message.channel === "email" ? withPixel(message.html || `<pre>${escape(message.text)}</pre>`, origin, id) : undefined
  let ok = true
  let detail = "guardado en el registro local"
  if (message.channel === "email" && process.env.RESEND_API_KEY) {
    const from = process.env.EMAIL_FROM || "Solera <reservas@solera.example>"
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject || "Solera", html: html || message.text }),
    })
    ok = res.ok
    detail = ok ? "resend" : `resend ${res.status}: ${await res.text()}`
  }
  if (message.channel === "whatsapp" && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
    const to = message.to.replace(/\D/g, "")
    const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: message.text.slice(0, 4000) } }),
    })
    ok = res.ok
    detail = ok ? "whatsapp" : `whatsapp ${res.status}: ${await res.text()}`
  }
  return {
    id,
    at: new Date().toISOString(),
    channel: message.channel,
    to: message.to,
    subject: message.subject,
    body: message.text,
    kind: message.kind,
    customerId: message.customerId,
    campaignId: message.campaignId,
    appointmentId: message.appointmentId,
    ok,
    detail,
    opened: false,
  }
}

function withPixel(html: string, origin: string, id: string): string {
  return html.replace("</div></div>", `</div><img src="${origin}/api/o/${id}" alt="" width="1" height="1" /></div>`)
}

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
}
