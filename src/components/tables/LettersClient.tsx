'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/layout/Topbar'

interface Letter { id: string; no: number; letter_no: string; subject: string; date: string | null; remarks: string | null }

interface Props { table: 'letters_rawaf_naga' | 'letters_naga_rawaf'; title: string; sub: string }

export default function LettersClient({ table, title, sub }: Props) {
  const supabase = createClient()
  const [letters, setLetters] = useState<Letter[]>([])
  const [filtered, setFiltered] = useState<Letter[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from(table).select('*').order('no', { ascending: true })
    setLetters(data ?? [])
    setFiltered(data ?? [])
    setLoading(false)
  }, [table])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!q) { setFiltered(letters); return }
    setFiltered(letters.filter(l =>
      l.subject.includes(q) || l.letter_no.includes(q)
    ))
  }, [q, letters])

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(letters)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Letters')
    XLSX.writeFile(wb, `${table}_P179.xlsx`)
  }

  return (
    <>
      <Topbar
        title={title}
        sub={`${sub} · ${letters.length} خطاب`}
        actions={
          <button className="btn btn-ghost btn-sm" onClick={exportExcel}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            تصدير
          </button>
        }
      />
      <div className="page-content anim">
        <div className="toolbar">
          <div className="search-wrap">
            <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input placeholder="بحث في الخطابات..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{filtered.length} خطاب</span>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /><span>جارٍ التحميل...</span></div>
        ) : (
          <div className="letter-list">
            {filtered.map(l => (
              <div key={l.id} className="letter-card">
                <div className="letter-no">{l.no}</div>
                <div className="letter-code">{l.letter_no}</div>
                <div className="letter-subject">{l.subject}</div>
                <div className="letter-date">{l.date ?? '—'}</div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)', flexShrink: 0 }}>
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <div className="empty-title">لا توجد خطابات مطابقة</div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
