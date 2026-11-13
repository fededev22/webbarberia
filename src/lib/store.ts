/**
 * Persistencia. Sin claves de Supabase el estado vive en data/db.json (local)
 * o en /tmp en Vercel. Con SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, el mismo
 * documento se reparte en filas jsonb de solera_records.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { buildSeed } from "./seed"
import type { Database } from "./types"

const ARRAYS = ["services", "products", "barbers", "appointments", "customers", "reviews", "waitlist", "coupons", "campaigns", "templates", "blocks", "messages", "admins", "attempts", "rates"] as const

let memory: Database | null = null
let queue: Promise<unknown> = Promise.resolve()
let sb: SupabaseClient | null | undefined

function supabase(): SupabaseClient | null {
  if (sb !== undefined) return sb
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
  return sb
}

function filePath(): string {
  if (process.env.VERCEL && !supabase()) return path.join("/tmp", "solera-db.json")
  return path.join(process.cwd(), "data", "db.json")
}

async function load(): Promise<Database> {
  // El archivo local se queda en memoria. Supabase se relee: en Vercel hay más de una instancia.
  if (memory && !supabase()) return memory
  const client = supabase()
  if (client) {
    const { data, error } = await client.from("solera_records").select("collection,id,payload")
    if (error) throw new Error(error.message)
    if (data && data.length) {
      memory = assemble(data as { collection: string; id: string; payload: unknown }[])
      return memory
    }
  } else {
    try {
      const raw = await readFile(filePath(), "utf8")
      memory = JSON.parse(raw) as Database
      return memory
    } catch {
      /* se crea el seed */
    }
  }
  memory = await buildSeed()
  await persist(memory, new Set(["services", "products", "barbers", "appointments", "customers", "reviews", "waitlist", "coupons", "campaigns", "templates", "blocks", "messages", "admins", "attempts", "rates", "settings"]))
  return memory
}

function assemble(rows: { collection: string; id: string; payload: unknown }[]): Database {
  const db = { version: 1 } as Database
  for (const key of ARRAYS) db[key] = [] as never
  for (const row of rows) {
    if (row.collection === "settings" && row.id === "main") db.settings = row.payload as Database["settings"]
    else if (ARRAYS.includes(row.collection as (typeof ARRAYS)[number])) {
      const list = db[row.collection as (typeof ARRAYS)[number]] as { id: string }[]
      list.push(row.payload as { id: string })
    }
  }
  return db
}

async function persist(db: Database, dirty: Set<string>) {
  memory = db
  const client = supabase()
  if (!client) {
    const file = filePath()
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(db, null, 2))
    return
  }
  for (const key of dirty) {
    if (key === "settings") {
      const { error } = await client.from("solera_records").upsert({ collection: "settings", id: "main", payload: db.settings })
      if (error) throw new Error(error.message)
      continue
    }
    if (!ARRAYS.includes(key as (typeof ARRAYS)[number])) continue
    const items = db[key as (typeof ARRAYS)[number]] as { id: string }[]
    if (items.length) {
      const { error } = await client.from("solera_records").upsert(items.map((item) => ({ collection: key, id: item.id, payload: item })))
      if (error) throw new Error(error.message)
    }
    const ids = items.map((item) => item.id)
    let query = client.from("solera_records").delete().eq("collection", key)
    if (ids.length) query = query.not("id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`)
    const { error } = await query
    if (error) throw new Error(error.message)
  }
}

function snapshot(db: Database): string[] {
  return [...ARRAYS.map((key) => JSON.stringify(db[key])), JSON.stringify(db.settings)]
}

export function update<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await load()
    const before = snapshot(db)
    const result = await fn(db)
    const after = snapshot(db)
    const dirty = new Set<string>()
    ARRAYS.forEach((key, i) => {
      if (before[i] !== after[i]) dirty.add(key)
    })
    if (before.at(-1) !== after.at(-1)) dirty.add("settings")
    if (dirty.size) await persist(db, dirty)
    else memory = db
    return result
  })
  queue = run.then(() => undefined, () => undefined)
  return run
}

export function read<T>(fn: (db: Database) => T): Promise<T> {
  return update(fn)
}

export async function resetDemo(): Promise<void> {
  memory = null
  await update(async (db) => {
    const fresh = await buildSeed()
    Object.assign(db, fresh)
  })
}
