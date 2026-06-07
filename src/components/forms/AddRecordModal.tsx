
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'date' | 'number' | 'select' | 'textarea'
  options?: string[]
  required?: boolean
}

interface Props {
  table: string
  title: string
  fields: FieldDef[]
  onClose: () => void
  onSaved: () => void
  autoNumber?: { field: string; getNext: () => Promise<number> }
}

export default function AddRecordModal({ table, title, fields, onClose, onSaved, autoNumber }: Props) {
  const supabase = createClient()
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-fill number field
  useEffect(() => {
    if (!autoNumber) return
    autoNumber.getNext().then(n => {
      setValues(prev => ({ ...prev, [autoNumber.field]: String(n) }))
    })
  }, [autoNumber])

  function set(key: string, val: string) {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    setLoading(true); setError('')
    const record: Record<string, unknown> = {}
    for (const f of fields) {
      const v = values[f.key] ?? ''
      if (!v && f.required) { setError(`حقل "${f.label}" مطلوب`); setLoading(false); return }
      if (v === '') continue
      if (f.type === 'number') record[f.key] = Number(v)
      else record[f.key] = v
    }
    // Include auto-number if present
    if (autoNumber && values[autoNumber.field]) {
      record[autoNumber.field] = Number(values[autoNumber.field])
    }
    const { error } = await supabase.from(table).insert(record)
    if (error) { setError(error.message); setLoading(false) }
    else { onSaved(); onClose() }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
          {fields.map(f => (
            <div
              key={f.key}
              className="form-group"
              style={f.type === 'textarea' ? { gridColumn:'1/-1' } : {}}
            >
              <label className="form-label">
                {f.label}
                {f.required && <span style={{ color:'var(--red)' }}> *</span>}
                {autoNumber?.field === f.key && (
                  <span style={{ color:'var(--green)', fontSize:10, marginRight:6 }}>● تلقائي</span>
                )}
              </label>

              {f.type === 'select' ? (
                <select
                  className="form-select"
                  value={values[f.key] ?? ''}
                  onChange={e => set(f.key, e.target.value)}
                >
                  <option value="">-- اختر --</option>
                  {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  className="form-input"
                  rows={3}
                  value={values[f.key] ?? ''}
                  onChange={e => set(f.key, e.target.value)}
                  style={{ resize:'vertical' }}
                />
              ) : (
                <input
                  className="form-input"
                  type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                  value={values[f.key] ?? ''}
                  onChange={e => set(f.key, e.target.value)}
                  readOnly={autoNumber?.field === f.key}
                  style={autoNumber?.field === f.key ? { opacity:.6, cursor:'default' } : {}}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            fontSize:12, color:'var(--red)',
            background:'#da363318', border:'1px solid #da363344',
            borderRadius:'var(--radius-sm)', padding:'8px 12px', marginBottom:12
          }}>
            {error}
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <span className="spinner"/> : 'حفظ السجل'}
          </button>
        </div>
      </div>
    </div>
  )
}
