'use client'
import LettersPage from '@/components/letters/LettersPage'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function RawafNagaPage() {
  const { t } = useLanguage()
  const p = t.pages.letters
  return <LettersPage
    table="letters_rawaf_naga"
    title={p.rawafNagaTitle}
    addTitle={p.rawafNagaAdd}
    exportFile="rawaf_naga_P179.xlsx"
  />
}
