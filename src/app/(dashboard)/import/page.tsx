
'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/layout/Topbar'
import styles from './import.module.css'

// ── Sheet → Table mapping ────────────────────────────────────────
const SHEET_MAP: Record<string, string> = {
  'SHOP DRAWING':        'shop_drawings',
  'MATERIAL SUBMITTAL':  'material_submittals',
  'SUPPLIER':            'supplier_prequalifications',
  'INSPECTION REQUEST':  'inspection_requests',
  'CONCRETE POUR':       'concrete_pour_requests',
  'RFI':                 'requests_for_information',
  'NCR':                 'non_conformance_reports',
  'TRANSMITTAL':         'document_transmittals',
  'RAWAF-NAGA':          'letters_rawaf_naga',
  'NAGA-RAWAF':          'letters_naga_rawaf',
}

const TABLE_LABELS: Record<string, string> = {
  shop_drawings:               'رسومات التنفيذ',
  material_submittals:         'تقديمات المواد',
  supplier_prequalifications:  'تأهيل الموردين',
  inspection_requests:         'طلبات الفحص',
  concrete_pour_requests:      'طلبات الصب',
  requests_for_information:    'طلبات الاستيضاح RFI',
  non_conformance_reports:     'تقارير عدم المطابقة',
  document_transmittals:       'إرسال الوثائق',
  letters_rawaf_naga:          'مراسلات الرواف ← نجا',
  letters_naga_rawaf:          'مراسلات نجا ← الرواف',
}

// ── Column mapping per table ─────────────────────────────────────
function mapRow(table: string, row: Record<string, unknown>, idx: number): Record<string, unknown> {
  const clean = (v: unknown) => (v === null || v === undefined || v === '') ? null : String(v).trim()

  // Flexible column getter — tries multiple name variants
  const get = (row: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) {
      // exact match
      if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]
      // case-insensitive match
      const found = Object.entries(row).find(([rk]) =>
        rk.trim().toUpperCase() === k.toUpperCase()
      )
      if (found && found[1] !== null && found[1] !== '') return found[1]
    }
    return null
  }
  const num   = (v: unknown) => { const n = Number(v); return isNaN(n) ? null : n }
  const date  = (v: unknown) => {
    if (!v) return null
    if (typeof v === 'number') {
      const d = new Date((v - 25569) * 86400 * 1000)
      return d.toISOString().slice(0, 10)
    }
    const s = String(v).trim()
    return s || null
  }

  const no = idx + 1

  switch (table) {
    case 'shop_drawings': return {
      no,
      request_no:      clean(get(row,'REQUEST NO','رقم الطلب','REF NO','NO.')),
      description:     clean(get(row,'DESCRIPTION','الوصف','TITLE','وصف الرسم')),
      element:         clean(get(row,'ELEMENT','العنصر','DISCIPLINE','TYPE')),
      rev:             num(get(row,'REV','REVISION','المراجعة')) ?? 0,
      submission_date: date(get(row,'SUBMISSION DATE','تاريخ التقديم','SUB DATE','DATE')),
      ac_co:           clean(get(row,'AC/CO','الحالة','STATUS','RESULT','AC CO')),
      approval_date:   date(get(row,'APPROVAL DATE','تاريخ الاعتماد','APP DATE')),
      v_time:          num(get(row,'V.TIME','V.Time','VTIME','DAYS')),
      remarks:         clean(get(row,'REMARKS','ملاحظات','NOTES','COMMENT')),
    }
    case 'material_submittals': return {
      no,
      request_no:      clean(get(row,'REQUEST NO','رقم الطلب','REF NO')),
      description:     clean(get(row,'DESCRIPTION','الوصف','TITLE')),
      element:         clean(get(row,'ELEMENT','العنصر','TYPE')) ?? 'GEN',
      rev:             num(get(row,'REV','REVISION')) ?? 0,
      submission_date: date(get(row,'SUBMISSION DATE','تاريخ التقديم','DATE')),
      status:          clean(get(row,'STATUS','الحالة','AC/CO','RESULT')),
      approval_date:   date(get(row,'APPROVAL DATE','تاريخ الاعتماد')),
      remarks:         clean(get(row,'REMARKS','ملاحظات')),
    }
    case 'supplier_prequalifications': return {
      no,
      supplier_name:   clean(get(row,'SUPPLIER NAME','اسم المورد','SUPPLIER','NAME')),
      trade:           clean(get(row,'TRADE','التخصص','SCOPE')),
      submission_date: date(get(row,'SUBMISSION DATE','تاريخ التقديم','DATE')),
      status:          clean(get(row,'STATUS','الحالة','RESULT')),
      remarks:         clean(get(row,'REMARKS','ملاحظات')),
    }
    case 'inspection_requests': return {
      no,
      ir_no:           clean(get(row,'IR NO','REQUEST NO','رقم الطلب','REF NO')),
      description:     clean(get(row,'DESCRIPTION','الوصف','TITLE')),
      location:        clean(get(row,'LOCATION','الموقع','AREA')),
      request_date:    date(get(row,'REQUEST DATE','تاريخ الطلب','DATE','SUBMISSION DATE')),
      inspection_date: date(get(row,'INSPECTION DATE','تاريخ الفحص')),
      result:          clean(get(row,'RESULT','STATUS','الحالة','AC/CO')),
      remarks:         clean(get(row,'REMARKS','ملاحظات')),
    }
    case 'concrete_pour_requests': return {
      no,
      cpr_no:      clean(get(row,'CPR NO','REQUEST NO','رقم الطلب','REF NO')),
      description: clean(get(row,'DESCRIPTION','الوصف','ELEMENT DESC','TITLE')),
      location:    clean(get(row,'LOCATION','الموقع','AREA')),
      pour_date:   date(get(row,'POUR DATE','DATE','تاريخ الصب')),
      volume_m3:   num(get(row,'VOLUME M3','VOLUME','الحجم','M3')),
      mix_design:  clean(get(row,'MIX DESIGN','MIX','التصميم')),
      status:      clean(get(row,'STATUS','الحالة','RESULT','AC/CO')),
      remarks:     clean(get(row,'REMARKS','ملاحظات')),
    }
    case 'requests_for_information': return {
      no,
      rfi_no:          clean(get(row,'RFI NO','REQUEST NO','رقم الطلب','REF NO')),
      subject:         clean(get(row,'SUBJECT','الموضوع','TITLE','DESCRIPTION')),
      submission_date: date(get(row,'SUBMISSION DATE','DATE','تاريخ التقديم')),
      response_date:   date(get(row,'RESPONSE DATE','REPLY DATE','تاريخ الرد')),
      status:          clean(get(row,'STATUS','الحالة','RESULT','AC/CO')),
      question:        clean(get(row,'QUESTION','السؤال')),
      answer:          clean(get(row,'ANSWER','الإجابة')),
      remarks:         clean(get(row,'REMARKS','ملاحظات')),
    }
    case 'non_conformance_reports': return {
      no,
      ncr_no:            clean(get(row,'NCR NO','REQUEST NO','رقم التقرير','REF NO')),
      description:       clean(get(row,'DESCRIPTION','الوصف','TITLE')),
      location:          clean(get(row,'LOCATION','الموقع','AREA')),
      issue_date:        date(get(row,'ISSUE DATE','DATE','تاريخ الإصدار')),
      close_date:        date(get(row,'CLOSE DATE','تاريخ الإغلاق')),
      status:            clean(get(row,'STATUS','الحالة')) ?? 'Open',
      corrective_action: clean(get(row,'CORRECTIVE ACTION','CORRECTIVE','الإجراء')),
      remarks:           clean(get(row,'REMARKS','ملاحظات')),
    }
    case 'document_transmittals': return {
      no,
      transmittal_no: clean(get(row,'TRANSMITTAL NO','REQUEST NO','رقم الإرسال','REF NO')),
      subject:        clean(get(row,'SUBJECT','الموضوع','TITLE','DESCRIPTION')),
      from_party:     clean(get(row,'FROM','من','FROM PARTY')),
      to_party:       clean(get(row,'TO','إلى','TO PARTY')),
      date:           date(get(row,'DATE','التاريخ','TRANSMITTAL DATE')),
      no_of_copies:   num(get(row,'COPIES','NO OF COPIES','النسخ')) ?? 1,
      remarks:        clean(get(row,'REMARKS','ملاحظات')),
    }
    case 'letters_rawaf_naga':
    case 'letters_naga_rawaf': return {
      no,
      letter_no: clean(get(row,'LETTER NO','رقم الخطاب','REF NO','CODE','NO.')),
      subject:   clean(get(row,'SUBJECT','الموضوع','TITLE','DESCRIPTION')),
      date:      date(get(row,'DATE','التاريخ','LETTER DATE')),
      remarks:   clean(get(row,'REMARKS','ملاحظات')),
    }
    default: return { no, ...row }
  }
}

type SheetPreview = {
  sheetName: string
  table: string
  label: string
  count: number
  sample: Record<string, unknown>[]
}

type ImportResult = { success: number; error: string | null }

const COL_RENAME: Record<string, Record<string, string>> = {
  shop_drawings: {
    no:'NO.', request_no:'REQUEST NO', description:'DESCRIPTION', element:'ELEMENT',
    rev:'REV', submission_date:'SUBMISSION DATE', ac_co:'AC/CO',
    approval_date:'APPROVAL DATE', v_time:'V.TIME', remarks:'REMARKS',
  },
  material_submittals: {
    no:'NO.', request_no:'REQUEST NO', description:'DESCRIPTION', element:'ELEMENT',
    rev:'REV', submission_date:'SUBMISSION DATE', status:'STATUS',
    approval_date:'APPROVAL DATE', remarks:'REMARKS',
  },
  supplier_prequalifications: {
    no:'NO.', supplier_name:'SUPPLIER NAME', trade:'TRADE',
    submission_date:'SUBMISSION DATE', status:'STATUS', remarks:'REMARKS',
  },
  inspection_requests: {
    no:'NO.', ir_no:'IR NO', description:'DESCRIPTION', location:'LOCATION',
    request_date:'REQUEST DATE', inspection_date:'INSPECTION DATE',
    result:'RESULT', remarks:'REMARKS',
  },
  concrete_pour_requests: {
    no:'NO.', cpr_no:'CPR NO', description:'DESCRIPTION', location:'LOCATION',
    pour_date:'POUR DATE', volume_m3:'VOLUME M3',
    mix_design:'MIX DESIGN', status:'STATUS', remarks:'REMARKS',
  },
  requests_for_information: {
    no:'NO.', rfi_no:'RFI NO', subject:'SUBJECT',
    submission_date:'SUBMISSION DATE', response_date:'RESPONSE DATE',
    status:'STATUS', question:'QUESTION', answer:'ANSWER', remarks:'REMARKS',
  },
  non_conformance_reports: {
    no:'NO.', ncr_no:'NCR NO', description:'DESCRIPTION', location:'LOCATION',
    issue_date:'ISSUE DATE', close_date:'CLOSE DATE', status:'STATUS',
    corrective_action:'CORRECTIVE ACTION', remarks:'REMARKS',
  },
  document_transmittals: {
    no:'NO.', transmittal_no:'TRANSMITTAL NO', subject:'SUBJECT',
    from_party:'FROM', to_party:'TO',
    date:'DATE', no_of_copies:'COPIES', remarks:'REMARKS',
  },
  letters_rawaf_naga: {
    no:'NO.', letter_no:'LETTER NO', subject:'SUBJECT', date:'DATE', remarks:'REMARKS',
  },
  letters_naga_rawaf: {
    no:'NO.', letter_no:'LETTER NO', subject:'SUBJECT', date:'DATE', remarks:'REMARKS',
  },
}

export default function ImportPage() {
  const supabase = createClient()
  const [status, setStatus]     = useState<'idle'|'parsing'|'preview'|'importing'|'done'|'error'>('idle')
  const [sheets, setSheets]     = useState<SheetPreview[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [parsed, setParsed]     = useState<Record<string, Record<string, unknown>[]>>({})
  const [results, setResults]   = useState<Record<string, ImportResult>>({})
  const [errorMsg, setErrorMsg] = useState('')
  const [dragging, setDragging] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [progress, setProgress] = useState<Record<string,boolean>>({})

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xlsm|xls)$/i)) {
      setErrorMsg('يرجى رفع ملف Excel فقط (.xlsx, .xlsm, .xls)')
      setStatus('error'); return
    }
    setStatus('parsing'); setErrorMsg('')
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type:'array', cellDates: false })

      const allParsed: Record<string, Record<string, unknown>[]> = {}
      const previews: SheetPreview[] = []

      for (const sheetName of wb.SheetNames) {
        // Match sheet name to table
        const table = Object.entries(SHEET_MAP).find(([key]) =>
          sheetName.toUpperCase().includes(key)
        )?.[1]
        if (!table) continue

        const ws = wb.Sheets[sheetName]
        const raw = XLSX.utils.sheet_to_json<Record<string,unknown>>(ws, { defval: null })
        if (raw.length === 0) continue

        const mapped = raw.map((row, i) => mapRow(table, row, i))
          .filter(r => Object.values(r).some(v => v !== null && v !== undefined && v !== ''))

        if (mapped.length === 0) continue

        allParsed[table] = mapped
        previews.push({
          sheetName,
          table,
          label: TABLE_LABELS[table] ?? table,
          count: mapped.length,
          sample: mapped.slice(0, 2),
        })
      }

      setSheets(previews)
      setParsed(allParsed)
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

  async function startImport() {
    setStatus('importing')
    const res: Record<string, ImportResult> = {}
    const prog: Record<string,boolean> = {}

    for (const table of selected) {
      const rows = parsed[table] ?? []
      if (!rows.length) continue
      prog[table] = false
      setProgress({...prog})
      try {
        // Step 1: حذف الأبناء أولاً (تجنب FK error)
        await supabase.from(table).delete().not('id', 'is', null).eq('is_archived', true)
        .match(() => {})
        // Step 2: حذف كل السجلات
        const { error: delErr } = await supabase.from(table).delete().not('id', 'is', null)
        if (delErr) console.warn('Delete warning:', delErr.message)

        // Step 3: إضافة الكل من جديد
        let success = 0
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100)
          const { error } = await supabase.from(table).insert(batch)
          if (error) throw new Error(error.message)
          success += batch.length
        }
        res[table] = { success, error: null }
      } catch (e: unknown) {
        res[table] = { success: 0, error: e instanceof Error ? e.message : String(e) }
      }
      prog[table] = true
      setProgress({...prog})
    }
    setResults(res)
    setStatus('done')
  }

  // ── Export All Data ───────────────────────────────────────────
  async function exportAll() {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      const EXPORT_SHEETS = [
        { table:'shop_drawings',              name:'رسومات التنفيذ' },
        { table:'material_submittals',        name:'تقديمات المواد' },
        { table:'supplier_prequalifications', name:'تأهيل الموردين' },
        { table:'inspection_requests',        name:'طلبات الفحص' },
        { table:'concrete_pour_requests',     name:'طلبات الصب' },
        { table:'requests_for_information',   name:'طلبات الاستيضاح' },
        { table:'non_conformance_reports',    name:'عدم المطابقة' },
        { table:'document_transmittals',      name:'إرسال الوثائق' },
        { table:'letters_rawaf_naga',         name:'الرواف-نجا' },
        { table:'letters_naga_rawaf',         name:'نجا-الرواف' },
      ]

      for (const sheet of EXPORT_SHEETS) {
        try {
          const allRows: Record<string, unknown>[] = []
          const PAGE_SIZE = 1000
          let from = 0
          let pageData: Record<string, unknown>[] = []

          do {
            const { data, error } = await supabase
              .from(sheet.table)
              .select('*')
              .order('id', { ascending: true })
              .range(from, from + PAGE_SIZE - 1)

            if (error) {
              console.warn(`Export warning [${sheet.table}]:`, error.message)
              break
            }

            pageData = data ?? []
            allRows.push(...pageData)
            from += PAGE_SIZE
          } while (pageData.length === PAGE_SIZE)

          setExportProgress(prev => prev + 1)

          if (allRows.length === 0) continue

          const SKIP = new Set(['id','parent_id','is_archived','revision_count','created_at','updated_at'])
          const colMap = COL_RENAME[sheet.table] ?? {}

          const cleaned = allRows.map(row => {
            const r: Record<string,unknown> = {}
            for (const [k, v] of Object.entries(row as Record<string,unknown>)) {
              if (SKIP.has(k)) continue
              const friendlyKey = colMap[k] ?? k
              r[friendlyKey] = v
            }
            return r
          })

          const ws = XLSX.utils.json_to_sheet(cleaned)
          const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
          ws['!cols'] = Array(range.e.c + 1).fill({ wch: 22 })
          XLSX.utils.book_append_sheet(wb, ws, sheet.name)

        } catch (sheetErr) {
          console.warn(`Export warning [${sheet.table}]:`, sheetErr)
          setExportProgress(prev => prev + 1)
        }
      }

      const date = new Date().toISOString().slice(0,10)
      XLSX.writeFile(wb, `P179_Export_${date}.xlsx`)
    } finally {
      setExporting(false)
      setExportProgress(0)
    }
  }

  // ── Download template (with actual DB data) ───────────────────
  async function downloadTemplate() {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      const TEMPLATE_DEFS = [
        { table:'shop_drawings',              sheetName:'SHOP DRAWING',       headers:['NO.','REQUEST NO','DESCRIPTION','ELEMENT','REV','SUBMISSION DATE','AC/CO','APPROVAL DATE','V.TIME','REMARKS'] },
        { table:'material_submittals',        sheetName:'MATERIAL SUBMITTAL', headers:['NO.','REQUEST NO','DESCRIPTION','ELEMENT','REV','SUBMISSION DATE','STATUS','APPROVAL DATE','REMARKS'] },
        { table:'supplier_prequalifications', sheetName:'SUPPLIER',           headers:['NO.','SUPPLIER NAME','TRADE','SUBMISSION DATE','STATUS','REMARKS'] },
        { table:'inspection_requests',        sheetName:'INSPECTION REQUEST', headers:['NO.','IR NO','DESCRIPTION','LOCATION','REQUEST DATE','INSPECTION DATE','RESULT','REMARKS'] },
        { table:'concrete_pour_requests',     sheetName:'CONCRETE POUR',      headers:['NO.','CPR NO','DESCRIPTION','LOCATION','POUR DATE','VOLUME M3','MIX DESIGN','STATUS','REMARKS'] },
        { table:'requests_for_information',   sheetName:'RFI',                headers:['NO.','RFI NO','SUBJECT','SUBMISSION DATE','RESPONSE DATE','STATUS','QUESTION','ANSWER','REMARKS'] },
        { table:'non_conformance_reports',    sheetName:'NCR',                headers:['NO.','NCR NO','DESCRIPTION','LOCATION','ISSUE DATE','CLOSE DATE','STATUS','CORRECTIVE ACTION','REMARKS'] },
        { table:'document_transmittals',      sheetName:'TRANSMITTAL',        headers:['NO.','TRANSMITTAL NO','SUBJECT','FROM','TO','DATE','COPIES','REMARKS'] },
        { table:'letters_rawaf_naga',         sheetName:'RAWAF-NAGA',         headers:['NO.','LETTER NO','SUBJECT','DATE','REMARKS'] },
        { table:'letters_naga_rawaf',         sheetName:'NAGA-RAWAF',         headers:['NO.','LETTER NO','SUBJECT','DATE','REMARKS'] },
      ]

      const SKIP = new Set(['id','parent_id','is_archived','revision_count','created_at','updated_at'])

      for (const def of TEMPLATE_DEFS) {
        try {
          const allRows: Record<string, unknown>[] = []
          const PAGE_SIZE = 1000
          let from = 0
          let pageData: Record<string, unknown>[] = []

          do {
            const { data, error } = await supabase
              .from(def.table)
              .select('*')
              .order('id', { ascending: true })
              .range(from, from + PAGE_SIZE - 1)

            if (error) break
            pageData = data ?? []
            allRows.push(...pageData)
            from += PAGE_SIZE
          } while (pageData.length === PAGE_SIZE)

          setExportProgress(prev => prev + 1)

          const colMap = COL_RENAME[def.table] ?? {}

          // Map DB column names → friendly names
          const friendlyRows = allRows.map(row => {
            const r: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
              if (SKIP.has(k)) continue
              r[colMap[k] ?? k] = v
            }
            return r
          })

          // Sort by NO.
          friendlyRows.sort((a, b) => Number(a['NO.'] ?? 0) - Number(b['NO.'] ?? 0))

          // Build 2D array: header row + data rows in column order
          const aoa: unknown[][] = [def.headers]
          for (const row of friendlyRows) {
            aoa.push(def.headers.map(h => row[h] ?? ''))
          }

          const ws = XLSX.utils.aoa_to_sheet(aoa)
          const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = XLSX.utils.encode_cell({ r: 0, c })
            if (!ws[cell]) continue
            ws[cell].s = { font:{bold:true}, fill:{fgColor:{rgb:'1F6FEB'}}, alignment:{horizontal:'center'} }
          }
          ws['!cols'] = Array(def.headers.length).fill({ wch: 22 })
          XLSX.utils.book_append_sheet(wb, ws, def.sheetName)
        } catch (e) {
          console.warn(`Template warning [${def.table}]:`, e)
          setExportProgress(prev => prev + 1)
        }
      }

      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `P179_Export_${date}.xlsx`)
    } finally {
      setExporting(false)
      setExportProgress(0)
    }
  }

  const totalRows = [...selected].reduce((s,t) => s+(parsed[t]?.length??0), 0)

  return (
    <>
      <Topbar
        title="استيراد البيانات من Excel"
        sub="رفع ملف Excel وتعبئة قاعدة البيانات تلقائياً"
        actions={<>
          <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            تحميل نموذج Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={exportAll} disabled={exporting}>
            {exporting ? (
              <><span className="spinner" style={{width:13,height:13}}/> جارٍ التصدير... ({exportProgress}/10)</>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              تصدير كل البيانات</>
            )}
          </button>
        </>}
      />

      <div className="page-content">

        {/* ── Drop Zone ── */}
        {(status === 'idle' || status === 'error') && (
          <div
            className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input id="fileInput" type="file" accept=".xlsx,.xlsm,.xls"
              onChange={e => { const f=e.target.files?.[0]; if(f) processFile(f) }}
              style={{display:'none'}}/>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{color:'var(--blue)',marginBottom:16}}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div className={styles.dropTitle}>اسحب ملف Excel هنا أو اضغط للاختيار</div>
            <div className={styles.dropSub}>يدعم .xlsx · .xlsm · .xls</div>
            <div className={styles.dropHint}>
              الشيتات المدعومة: SHOP DRAWING · MATERIAL SUBMITTAL · SUPPLIER · INSPECTION REQUEST ·
              CONCRETE POUR · RFI · NCR · TRANSMITTAL · RAWAF-NAGA · NAGA-RAWAF
            </div>
            {errorMsg && <div className={styles.errMsg}>{errorMsg}</div>}
          </div>
        )}

        {/* ── Parsing ── */}
        {status === 'parsing' && (
          <div className={styles.loading}>
            <div className="spinner" style={{width:32,height:32,borderWidth:3}}/>
            <div>جارٍ قراءة الملف وتحليل الشيتات...</div>
          </div>
        )}

        {/* ── Preview ── */}
        {status === 'preview' && (
          <div>
            <div className={styles.previewBar}>
              <div>
                <div className={styles.previewTitle}>معاينة البيانات</div>
                <div className={styles.previewSub}>
                  تم العثور على {sheets.length} شيت · {sheets.reduce((s,sh)=>s+sh.count,0)} سجل إجمالي
                </div>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button className="btn btn-ghost" onClick={()=>setStatus('idle')}>← اختر ملفاً آخر</button>
                <button className="btn btn-primary" onClick={startImport} disabled={!selected.size}>
                  استيراد {totalRows} سجل من {selected.size} شيت
                </button>
              </div>
            </div>

            <div className={styles.sheetGrid}>
              {sheets.map(s => (
                <div key={s.table}
                  className={`${styles.sheetCard} ${selected.has(s.table)?styles.selected:''}`}
                  onClick={() => setSelected(prev => {
                    const n=new Set(prev); n.has(s.table)?n.delete(s.table):n.add(s.table); return n
                  })}>
                  <div className={styles.sheetCheck}>
                    {selected.has(s.table)
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : <div style={{width:16,height:16,border:'2px solid var(--border)',borderRadius:4}}/>
                    }
                  </div>
                  <div style={{flex:1}}>
                    <div className={styles.sheetLabel}>{s.label}</div>
                    <div className={styles.sheetMeta}>{s.sheetName} · {s.count} سجل</div>
                  </div>
                  <span className={styles.sheetCount}>{s.count}</span>
                </div>
              ))}
            </div>

            {sheets.length === 0 && (
              <div className="empty-state">
                <div className="empty-title">لم يتم العثور على شيتات مطابقة</div>
                <div className="empty-sub">تأكد أن أسماء الشيتات تحتوي على: SHOP DRAWING, RFI, NCR...</div>
              </div>
            )}
          </div>
        )}

        {/* ── Importing ── */}
        {status === 'importing' && (
          <div className={styles.importingWrap}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:24}}>جارٍ الاستيراد...</div>
            {[...selected].map(table => (
              <div key={table} className={styles.progressRow}>
                <div className={styles.progressLabel}>{TABLE_LABELS[table]}</div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill}
                    style={{width: progress[table] ? '100%' : '0%',
                      background: progress[table] ? 'var(--green)' : 'var(--blue)'}}/>
                </div>
                <div className={styles.progressStatus}>
                  {progress[table] ? '✓' : <div className="spinner" style={{width:14,height:14}}/>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Done ── */}
        {status === 'done' && (
          <div>
            <div className={styles.doneHeader}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <div>
                <div className={styles.doneTitle}>اكتمل الاستيراد بنجاح!</div>
                <div className={styles.doneSub}>
                  {Object.values(results).reduce((s,r)=>s+r.success,0)} سجل تم استيراده
                </div>
              </div>
            </div>

            <div className={styles.resultsGrid}>
              {Object.entries(results).map(([table, r]) => (
                <div key={table} className={`${styles.resultCard} ${r.error?styles.resultErr:styles.resultOk}`}>
                  <div className={styles.resultLabel}>{TABLE_LABELS[table]}</div>
                  <div className={styles.resultCount}>
                    {r.error ? `❌ ${r.error.slice(0,60)}` : `✅ ${r.success} سجل`}
                  </div>
                </div>
              ))}
            </div>

            <div style={{display:'flex',gap:12,marginTop:24}}>
              <button className="btn btn-primary" onClick={()=>window.location.href='/dashboard'}>
                → الذهاب للوحة التحكم
              </button>
              <button className="btn btn-ghost" onClick={()=>{setStatus('idle');setSheets([]);setResults({})}}>
                استيراد ملف آخر
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
