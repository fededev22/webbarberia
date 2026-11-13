"use client"

import { MotionConfig } from "motion/react"
import { createContext, useContext, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Lenis from "lenis"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

type Lang = "es" | "en"
type Theme = "dark" | "light"
type Ui = {
  lang: Lang
  theme: Theme
  setLang: (lang: Lang) => void
  setTheme: (theme: Theme) => void
  t: (es: string, en: string) => string
}

const Ctx = createContext<Ui | null>(null)

export function useUi() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useUi")
  return ctx
}

export function Providers({ children, initialLang, initialTheme }: { children: React.ReactNode; initialLang: Lang; initialTheme: Theme }) {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const path = usePathname()
  const admin = path.startsWith("/administrador")

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dataset.theme = theme
    document.cookie = `solera-lang=${lang};path=/;max-age=31536000`
    document.cookie = `solera-theme=${theme};path=/;max-age=31536000`
  }, [lang, theme])

  useEffect(() => {
    if (admin) return
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!fine || reduce) return
    gsap.registerPlugin(ScrollTrigger)
    const lenis = new Lenis({ lerp: 0.12, smoothWheel: true })
    const onScroll = () => ScrollTrigger.update()
    lenis.on("scroll", onScroll)
    const ticker = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(ticker)
    gsap.ticker.lagSmoothing(0)
    const root = window as Window & { __lenis?: Lenis }
    root.__lenis = lenis
    return () => {
      gsap.ticker.remove(ticker)
      lenis.destroy()
      root.__lenis = undefined
    }
  }, [admin])

  const t = (es: string, en: string) => (lang === "en" ? en : es)
  return (
    <Ctx.Provider value={{ lang, theme, setLang, setTheme, t }}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </Ctx.Provider>
  )
}
