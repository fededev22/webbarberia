/** Open-Meteo no pide clave. Si falla, no hay descuento de lluvia: la reserva sigue. */
let cache: { at: number; rainy: boolean } | null = null

export async function isRainy(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 30 * 60_000) return cache.rainy
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=-34.58&longitude=-58.43&current=precipitation,weather_code&timezone=America%2FArgentina%2FBuenos_Aires&forecast_days=1"
    const res = await fetch(url, { next: { revalidate: 1800 } })
    if (!res.ok) return false
    const data = (await res.json()) as { current?: { precipitation?: number; weather_code?: number } }
    const code = data.current?.weather_code ?? 0
    const rain = (data.current?.precipitation ?? 0) > 0.2 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95
    cache = { at: Date.now(), rainy: rain }
    return rain
  } catch {
    return false
  }
}
