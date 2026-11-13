import { getSession } from "@/lib/auth"
import { serviceNames } from "@/lib/engine"
import { fail } from "@/lib/http"
import { read } from "@/lib/store"
import { dateKey, formatTime } from "@/lib/time"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return fail("No autorizado", 401)
  const url = new URL(req.url)
  const kind = url.searchParams.get("kind") === "appointments" ? "appointments" : "customers"
  const format = url.searchParams.get("format") === "xls" ? "xls" : "csv"
  const table = await read((db) => {
    if (kind === "customers") {
      return {
        name: "clientes",
        headers: ["Nombre", "Email", "Teléfono", "Sellos", "Alta", "Marketing"],
        rows: db.customers.map((c) => [c.name, c.email, c.phone, String(c.stamps), c.createdAt.slice(0, 10), c.marketingOptIn ? "sí" : "no"]),
      }
    }
    const tz = db.settings.timezone
    return {
      name: "turnos",
      headers: ["Fecha", "Hora", "Cliente", "Teléfono", "Servicio", "Barbero", "Estado", "Total"],
      rows: db.appointments.map((a) => [
        dateKey(a.start, tz),
        formatTime(a.start, tz),
        a.customerName,
        a.phone,
        serviceNames(db, a.serviceIds),
        db.barbers.find((b) => b.id === a.barberId)?.name ?? "",
        a.status,
        String(a.total),
      ]),
    }
  })
  if (format === "csv") {
    const lines = [table.headers, ...table.rows].map((row) => row.map(csv).join(",")).join("\r\n")
    return new Response(`\uFEFF${lines}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${table.name}.csv"`,
      },
    })
  }
  const header = table.headers.map((cell) => `<Cell><Data ss:Type="String">${xml(cell)}</Data></Cell>`).join("")
  const body = table.rows
    .map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${xml(cell)}</Data></Cell>`).join("")}</Row>`)
    .join("")
  const xls = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${table.name}"><Table><Row>${header}</Row>${body}</Table></Worksheet></Workbook>`
  return new Response(xls, {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": `attachment; filename="${table.name}.xls"`,
    },
  })
}

function csv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
}
