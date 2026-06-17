'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'date' | 'number' | 'select' | 'textarea'
  options?: string[]
  required?: boolean
  defaultValue?: string
  prefixStatic?: string
  prefixDynamic?: { fromField: string; map: Record<string, string> }
}

interface Props {
  table: string
  title: string
  fields: FieldDef[]
  onClose: () => void
  onSaved: () => void
  autoNumber?: { field: string; getNext: () => Promise<number> }
  fixedValues?: Record<string, string>
  onSaveAndGenerate?: (record: Record<string, unknown>) => void
}

export default function AddRecordModal({ table, title, fields, onClose, onSaved, autoNumber, fixedValues, onSaveAndGenerate }: Props) {
  const supabase = createClient()
  const { t } = useLanguage()
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-fill: fixed values + static prefixes + defaults
  useEffect(() => {
    const init: Record<string, string> = {}
    if (fixedValues) Object.assign(init, fixedValues)
    for (const f of fields) {
      if (f.defaultValue && !init[f.key]) init[f.key] = f.defaultValue
      if (f.prefixStatic && !init[f.key]) init[f.key] = f.prefixStatic
    }
    setValues(prev => ({ ...prev, ...init }))
  }, [])

  useEffect(() => {
    if (!autoNumber) return
    autoNumber.getNext().then(n => {
      setValues(prev => ({ ...prev, [autoNumber.field]: String(n) }))
    })
  }, [autoNumber])

  // Auto-calculate V.Time + auto-prefix
  function set(key: string, val: string) {
    setValues(prev => {
      const next = { ...prev, [key]: val }
      // Auto-prefix: when element changes, update request_no prefix
      for (const f of fields) {
        if (f.prefixDynamic && f.prefixDynamic.fromField === key) {
          const prefix    = f.prefixDynamic.map[val] ?? ''
          const current   = next[f.key] ?? ''
          const oldPrefix = f.prefixDynamic.map[prev[key] ?? ''] ?? ''
          if (!current || current === oldPrefix || current.startsWith(oldPrefix)) {
            next[f.key] = prefix
          }
        }
      }
      const sub = key === 'submission_date' ? val : next['submission_date']
      const app = key === 'approval_date'   ? val : next['approval_date']
      const prd = key === 'pour_date'       ? val : next['pour_date']
      const appDate = app || next['approval_date']
      const subDate = sub || prd
      if (subDate && appDate) {
        const diff = new Date(appDate).getTime() - new Date(subDate).getTime()
        if (diff >= 0) next['v_time'] = String(Math.round(diff / 86400000))
        else next['v_time'] = ''
      }
      return next
    })
  }

  function isFixed(key: string) {
    return !!(fixedValues && key in fixedValues)
  }

  async function handleSaveAndGenerate() {
    // Build record same as handleSave but also call onSaveAndGenerate
    const record: Record<string, unknown> = {}
    if (fixedValues) Object.assign(record, fixedValues)
    for (const f of fields) {
      if (fixedValues && f.key in fixedValues) continue
      const v = values[f.key] ?? ''
      if (!v && f.required) { setError(t.common.fieldRequired.replace('{label}', f.label)); return }
      if (v === '') continue
      if (f.type === 'number') record[f.key] = Number(v)
      else record[f.key] = v
    }
    if (autoNumber && values[autoNumber.field]) {
      record[autoNumber.field] = Number(values[autoNumber.field])
    }
    setLoading(true); setError('')
    const { error } = await supabase.from(table).insert(record)
    if (error) { setError(error.message); setLoading(false) }
    else {
      onSaved()
      onSaveAndGenerate?.(record)
      onClose()
    }
  }

  async function handleSave() {
    setLoading(true); setError('')
    const record: Record<string, unknown> = {}

    // Include fixed values first
    if (fixedValues) {
      for (const [k, v] of Object.entries(fixedValues)) {
        record[k] = v
      }
    }

    for (const f of fields) {
      if (isFixed(f.key)) continue  // already included
      const v = values[f.key] ?? ''
      if (!v && f.required) { setError(t.common.fieldRequired.replace('{label}', f.label)); setLoading(false); return }
      if (v === '') continue
      if (f.type === 'number') record[f.key] = Number(v)
      else record[f.key] = v
    }

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

        <div style={{ 
          display:'grid', 
          gridTemplateColumns:'1fr 1fr', 
          gap:'0 16px' }}>
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
                  <span style={{ color:'var(--green)', fontSize:10, marginRight:6 }}>● {t.common.autoBadge}</span>
                )}
                {f.key === 'v_time' && (
                  <span style={{ color:'var(--blue)', fontSize:10, marginRight:6 }}>● {t.docs.vtimeAuto}</span>
                )}
                {isFixed(f.key) && (
                  <span style={{ color:'var(--amber)', fontSize:10, marginRight:6 }}>● {t.common.fixedBadge}</span>
                )}
              </label>

              {f.type === 'select' ? (
                <select
                  className="form-select"
                  value={isFixed(f.key) ? (fixedValues![f.key]) : (values[f.key] ?? '')}
                  onChange={e => !isFixed(f.key) && set(f.key, e.target.value)}
                  disabled={isFixed(f.key)}
                  style={isFixed(f.key) ? { opacity:.6, cursor:'default' } : {}}
                >
                  <option value="">{t.common.selectPlaceholder}</option>
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
                  value={isFixed(f.key) ? fixedValues![f.key] : (values[f.key] ?? '')}
                  onChange={e => !isFixed(f.key) && set(f.key, e.target.value)}
                  readOnly={autoNumber?.field === f.key || f.key === 'v_time' || isFixed(f.key)}
                  style={(autoNumber?.field === f.key || f.key === 'v_time' || isFixed(f.key))
                    ? { opacity:.6, cursor:'default' } : {}}
                  placeholder={
                    f.prefixDynamic ? (f.prefixDynamic.map[values[f.prefixDynamic.fromField] ?? ''] ?? '') :
                    f.prefixStatic  ? f.prefixStatic :
                    undefined}
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
          <button className="btn btn-ghost" onClick={onClose}>{t.common.cancel}</button>
          {onSaveAndGenerate && (
            <button className="btn btn-ghost" onClick={() => handleSaveAndGenerate()} disabled={loading}
              style={{ borderColor:'var(--green)', color:'var(--green)' }}>
              {loading ? <span className="spinner"/> : <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                {t.common.saveAndGenerate}
              </>}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <span className="spinner"/> : t.common.saveRecord}
          </button>
        </div>
      </div>
    </div>
  )
}
