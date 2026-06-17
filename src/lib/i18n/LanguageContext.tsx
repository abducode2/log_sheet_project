'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { translations, type Lang, type Translations } from './translations'

const STORAGE_KEY = 'p216-lang'
const DEFAULT: Lang = 'ar'

type TranslationValue = (typeof translations)[Lang]

interface LanguageCtx {
  lang: Lang
  t: TranslationValue
  setLang: (l: Lang) => void
}

const LanguageContext = createContext<LanguageCtx>({
  lang: DEFAULT,
  t: translations[DEFAULT],
  setLang: () => {},
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT)

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Lang | null) ?? DEFAULT
    applyLang(stored)
    setLangState(stored)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    applyLang(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

function applyLang(l: Lang) {
  const dir = translations[l].dir
  document.documentElement.setAttribute('lang', l)
  document.documentElement.setAttribute('dir', dir)
  document.body.style.direction = dir
}

export function useLanguage() {
  return useContext(LanguageContext)
}
