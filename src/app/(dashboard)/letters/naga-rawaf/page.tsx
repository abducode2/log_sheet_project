'use client'
import LettersPage from '@/components/letters/LettersPage'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function NagaRawafPage() {
  const { t } = useLanguage()
  const p = t.pages.letters
  return <LettersPage
    table="letters_naga_rawaf"
    title={p.nagaRawafTitle}
    addTitle={p.nagaRawafAdd}
    exportFile="naga_rawaf_P179.xlsx"
  />
}
