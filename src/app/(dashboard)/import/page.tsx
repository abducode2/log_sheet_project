
'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseExcelFile, SHEET_MAP } from '@/lib/utils/import'
import Topbar from '@/components/layout/Topbar'
import styles from './import.module.css'

const TABLE_LABELS: Record<string, string> = {
  shop_drawings:                  'رسومات التنفيذ',
  supplier_prequalifications:     'تأهيل الموردين',
  material_submittals:            'تقديمات المواد',
  material_inspection_requests:   'فحص المواد',
  document_transmittals:          'إرسال الوثائق',
  inspection_requests:            'طلبات الفحص',
  inspection_requests_unifier:    'الفحص - Unifier',
  cpr_unifier:                    'CPR - Unifier',
  concrete_pour_requests:         'طلبات الصب',
  requests_for_information:       'RFI',
  non_conformance_reports:        'NCR',
  field_reports:                  'التقارير الميدانية',
  letters_rawaf_naga:             'الرواف ← نجا',
  letters_naga_rawaf:             'نجا ← الرواف',
}

type SheetPreview = { table: string; label: string; count: number; sample: Record<string, unknown>[] }
type Status = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error'

export default function ImportPage() {
  const supabase = createClient()
  const [status, setStatus]       = useState<Status>('idle')
  const [sheets, setSheets]       = useState<SheetPreview[]>([])
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [parsed, setParsed]       = useState<Record<string, Record<string, unknown>[]>>({})
  const [results, setResults]     = useState<Record<string, { success: number; error: string | null }>>({})
  const [errorMsg, setErrorMsg]   = useState('')
  const [dragging, setDragging]   = useState(false)

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xlsm|xls)$/i)) {
      setErrorMsg('يرجى رفع ملف Excel فقط (.xlsx, .xlsm, .xls)')
      setStatus('error'); return
    }
    setStatus('parsing'); setErrorMsg('')
    try {
      const data = await parseExcelFile(file)
      const previews: SheetPreview[] = Object.entries(data).map(([table, rows]) => ({
        table, label: TABLE_LABELS[table] ?? table,
        count: rows.length,
        sample: rows.slice(0, 3),
      }))
      setSheets(previews)
      setParsed(data)
      setSelected(new Set(previews.map(p => p.table)))
      setStatus('preview')
    } catch (e) {
      setErrorMsg('فشل في قراءة الملف: ' + String(e))
      setStatus('error')
    }
  }, [])

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function toggleSheet(table: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(table) ? next.delete(table) : next.add(table)
      return next
    })
  }

  async function startImport() {
    setStatus('importing')
    const res: Record<string, { success: number; error: string | null }> = {}

    for (const table of selected) {
      const rows = parsed[table] ?? []
      if (rows.length === 0) continue
      try {
        // Import in batches of 100
        let success = 0
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100)
          const { error } = await supabase.from(table).upsert(batch, { onConflict: 'no' })
          if (error) throw error
          success += batch.length
        }
        res[table] = { success, error: null }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        res[table] = { success: 0, error: msg }
      }
    }
    setResults(res)
    setStatus('done')
  }

  const totalRows = [...selected].reduce((s, t) => s + (parsed[t]?.length ?? 0), 0)

  return (
    <>
      <Topbar title="استيراد البيانات من Excel" sub="رفع ملف P-179 واستيراد جميع الأوراق" />
      <div className="page-content anim">

        {/* Drop Zone */}
        {(status === 'idle' || status === 'error') && (
          <div
            className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input id="fileInput" type="file" accept=".xlsx,.xlsm,.xls" onChange={onFileChange} style={{ display: 'none' }} />
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--blue)', marginBottom: 16 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div className={styles.dropTitle}>اسحب ملف Excel هنا أو اضغط للاختيار</div>
            <div className={styles.dropSub}>يدعم ملف Log_Sheet-P-179.xlsm وجميع إصداراته · xlsx, xlsm, xls</div>
            {errorMsg && <div className={styles.errorMsg}>{errorMsg}</div>}
          </div>
        )}

        {/* Parsing */}
        {status === 'parsing' && (
          <div className={styles.loading}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            <div>جارٍ قراءة الملف وتحليل الأوراق...</div>
          </div>
        )}

        {/* Preview */}
        {status === 'preview' && (
          <div>
            <div className={styles.previewHeader}>
              <div>
                <div className={styles.previewTitle}>معاينة البيانات</div>
                <div className={styles.previewSub}>اختر الأوراق التي تريد استيرادها</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" onClick={() => setStatus('idle')}>← اختر ملفاً آخر</button>
                <button className="btn btn-primary" onClick={startImport} disabled={selected.size === 0}>
                  استيراد {totalRows} سجل من {selected.size} ورقة
                </button>
              </div>
            </div>

            <div className={styles.sheetGrid}>
              {sheets.map(s => (
                <div
                  key={s.table}
                  className={`${styles.sheetCard} ${selected.has(s.table) ? styles.sheetSelected : ''}`}
                  onClick={() => toggleSheet(s.table)}
                >
                  <div className={styles.sheetCheck}>
                    {selected.has(s.table)
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderRadius: 4 }} />
                    }
                  </div>
                  <div className={styles.sheetInfo}>
                    <div className={styles.sheetLabel}>{s.label}</div>
                    <div className={styles.sheetCount}>{s.count} سجل</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Importing */}
        {status === 'importing' && (
          <div className={styles.loading}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            <div>جارٍ رفع البيانات إلى Supabase...</div>
          </div>
        )}

        {/* Done */}
        {status === 'done' && (
          <div>
            <div className={styles.doneHeader}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <div>
                <div className={styles.doneTitle}>اكتمل الاستيراد</div>
                <div className={styles.doneSub}>
                  {Object.values(results).reduce((s, r) => s + r.success, 0)} سجل تم استيراده بنجاح
                </div>
              </div>
            </div>
            <div className={styles.resultsGrid}>
              {Object.entries(results).map(([table, r]) => (
                <div key={table} className={`${styles.resultCard} ${r.error ? styles.resultError : styles.resultOk}`}>
                  <div className={styles.resultLabel}>{TABLE_LABELS[table] ?? table}</div>
                  {r.error
                    ? <div className={styles.resultMsg}>❌ {r.error}</div>
                    : <div className={styles.resultMsg}>✅ {r.success} سجل</div>
                  }
                </div>
              ))}
            </div>
            <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => { setStatus('idle'); setSheets([]); setResults({}) }}>
              استيراد ملف آخر
            </button>
          </div>
        )}

      </div>
    </>
  )
}
