
'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/layout/Topbar'
import AddRecordModal from '@/components/forms/AddRecordModal'
import type { FieldDef } from '@/components/forms/AddRecordModal'
import styles from '@/app/dashboard.module.css'
import { generateForm } from '@/lib/utils/generateForm'
import { useRole } from '@/lib/hooks/useRole'
import { uploadToCloudinary, getCloudinaryViewerUrl } from '@/lib/utils/cloudinary'

// ── Helpers ──────────────────────────────────────────────────────
function calcVtime(sub: string | null, app: string | null): number | null {
  if (!sub || !app) return null
  const diff = new Date(app).getTime() - new Date(sub).getTime()
  return diff < 0 ? null : Math.round(diff / 86400000)
}
function today(): string { return new Date().toISOString().slice(0, 10) }

// ── Constants ────────────────────────────────────────────────────
// CPR is SC only — tabs are by status
const ELEMENTS = [
  { key:'ALL', label:'الكل',     color:'#8b949e' },
  { key:'A',   label:'معتمد',    color:'#3fb950' },
  { key:'B',   label:'معتمد ملاحظات', color:'#58a6ff' },
  { key:'C',   label:'مراجعة',   color:'#d29922' },
  { key:'D',   label:'مرفوض',    color:'#f85149' },
  { key:'P',   label:'انتظار',   color:'#8b949e' },
]

const STATUS_OPTS = ['A','B','C','D','P']
const STATUS_LABELS: Record<string,string> = {
  A:'معتمد', B:'معتمد مع ملاحظات', C:'مراجعة وإعادة تقديم', D:'مرفوض', P:'انتظار'
}
// Solid background colors for status cell (like the screenshot)
const STATUS_BG: Record<string,{bg:string;color:string}> = {
  A:{ bg:'#1a7f37', color:'#fff' },
  B:{ bg:'#1a7f37', color:'#fff' },
  C:{ bg:'#da3633', color:'#fff' },
  D:{ bg:'#6e2222', color:'#fff' },
  P:{ bg:'#444',    color:'#ccc' },
}


const FIELDS: FieldDef[] = [
  { key:'cpr_no',         label:'رقم الطلب',        type:'text',   required:true,
    prefixStatic:'J500-RWF-CPR-' },
  { key:'description',    label:'وصف العنصر',       type:'text',   required:true },
  { key:'pour_date',      label:'تاريخ الصب',        type:'date',   required:true },
  { key:'rev',            label:'رقم المراجعة',      type:'number' },
  { key:'volume_m3',      label:'الحجم م³',          type:'number' },
  { key:'mix_design', label:'Mix Design', type:'select', options:[
    '20 MPA OPC',
    '25 MPA OPC',
    '30 MPA OPC',
    '35 MPA OPC',
    '40 MPA OPC',
    '20 MPA SRC',
    '35 MPA SRC',
    'C20',
    'C25',
    'C30',
    'C35',
    'C40',
  ]},
  { key:'ac_co',          label:'حالة الاعتماد',     type:'select', defaultValue:'P', options:['A','B','C','D','P'] },
  { key:'approval_date',  label:'تاريخ الاعتماد',    type:'date' },
  { key:'v_time',         label:'V.Time (أيام)',     type:'number' },
  { key:'remarks',        label:'ملاحظات',           type:'textarea' },
]

const PG = 20

interface Row {
  id: string
  no: number
  cpr_no: string
  request_no?: string
  description: string
  rev: number
  ac_co: string
  pour_date: string | null
  volume_m3: number | null
  mix_design: string | null
  submission_date: string | null
  approval_date: string | null
  v_time: number | null
  remarks: string | null
  parent_id: string | null
  is_archived: boolean
  revision_count: number
  pdf_url: string | null
}

// Group rows: each group = root row + all its revisions
interface Group {
  root_request_no: string
  rows: Row[]          // sorted by rev asc
  no: number           // display number (from first row)
  description: string
}

function groupRows(rows: Row[]): Group[] {
  // Find root of each row (walk up parent_id chain)
  const idMap: Record<string, Row> = {}
  for (const r of rows) idMap[r.id] = r

  function getRootId(r: Row): string {
    if (!r.parent_id || !idMap[r.parent_id]) return r.id
    return getRootId(idMap[r.parent_id])
  }

  const map: Record<string, Row[]> = {}
  for (const r of rows) {
    const key = getRootId(r)
    if (!map[key]) map[key] = []
    map[key].push(r)
  }

  return Object.entries(map).map(([, group]) => {
    const sorted = group.sort((a,b) => (a.rev??0) - (b.rev??0))
    const root   = sorted[0]
    return {
      root_request_no: root.cpr_no ?? String(root.no),
      rows: sorted,
      no:          root.no,
      description: root.description,
    }
  }).sort((a,b) => a.no - b.no)
}

export default function CprPage() {
  const supabase = createClient()
  const { isAdmin, isEditor } = useRole()

  const [activeEl, setActiveEl]     = useState('ALL')
  const [allRows, setAllRows]       = useState<Row[]>([])
  const [groups, setGroups]         = useState<Group[]>([])
  const [total, setTotal]           = useState(0)
  const [counts, setCounts]         = useState<Record<string,number>>({})
  const [search, setSearch]         = useState('')
  const [filterSt, setFilterSt]     = useState('')
  // Column filters (Excel-style)
  const [colFilters, setColFilters] = useState<Record<string,string>>({
    cpr_no: '', description: '', rev: '', pour_date: '', volume_m3: '', mix_design: '', ac_co: ''
  })
  const [openCol, setOpenCol]       = useState<string|null>(null)
  const [loading, setLoading]       = useState(true)
  const [showAdd, setShowAdd]       = useState(false)

  // Edit state
  const [editingId, setEditingId]   = useState<string|null>(null)
  const [editSt, setEditSt]         = useState('')
  const [editDate, setEditDate]     = useState('')
  const [editVtime, setEditVtime]   = useState('')
  const [saving, setSaving]         = useState(false)

  // Dialogs
  const [confirmC, setConfirmC]     = useState<Row|null>(null)

  const [newRevNo,  setNewRevNo]    = useState('')
  const [newRevDesc,setNewRevDesc]  = useState('')
  const [newRevEl,  setNewRevEl]    = useState('')
  const [confirmDel, setConfirmDel]       = useState<Row|null>(null)
  const [deleting, setDeleting]           = useState(false)
  const [deleteBlockRow, setDeleteBlockRow] = useState<Row|null>(null)
  const [deleteBlockRevs, setDeleteBlockRevs] = useState<Row[]>([])

  const [uploadingId, setUploadingId] = useState<string|null>(null)
  const [viewingPdf, setViewingPdf]   = useState<{url:string;name:string;directUrl?:string}|null>(null)

  // Fetch counts (only root/non-archived for tab counts)
  const fetchCounts = useCallback(async () => {
    const { data } = await supabase
      .from('concrete_pour_requests')
      .select('id, parent_id, ac_co')
    if (!data) return
    const rows = data as { id: string; parent_id: string | null; ac_co: string }[]
    const c: Record<string, number> = { ALL: 0 }
    for (const r of rows) {
      if (!r.parent_id) {
        c['ALL'] = (c['ALL'] ?? 0) + 1
        c[r.ac_co] = (c[r.ac_co] ?? 0) + 1
      }
    }
    setCounts(c)
  }, [])

  // Fetch ALL rows (including archived) to group them
  const fetchData = useCallback(async () => {
    setLoading(true)

    // Fetch all rows for grouping
    let q = supabase
      .from('concrete_pour_requests')
      .select('*')
      .order('no', { ascending: true })
      .order('rev', { ascending: true })

    // CPR is always SC — filter by status tab
    if (activeEl !== 'ALL') q = q.eq('ac_co', activeEl)

    const { data } = await q
    const rows = (data ?? []) as Row[]

    // Client-side filtering across all fields
    const s = search.toLowerCase().trim()
    let filtered = rows

    // Apply column filters
   filtered = filtered.filter(r => {
      for (const [col, val] of Object.entries(colFilters)) {
        if (!val) continue
        const rv = String((r as unknown as Record<string,unknown>)[col] ?? '').toLowerCase()
        const vstr = String(val).toLowerCase()
        if (!rv.includes(vstr)) return false
      }
      return true
    })

    if (s) {
      // Find rows that match search
      const matchingIds = new Set(
        rows
          .filter(r =>
            (r.cpr_no          ?? '').toLowerCase().includes(s) ||
            (r.description     ?? '').toLowerCase().includes(s) ||
            (r.mix_design      ?? '').toLowerCase().includes(s) ||
            (r.description     ?? '').toLowerCase().includes(s) ||
            (r.ac_co           ?? '').toLowerCase().includes(s) ||
            (r.pour_date       ?? '').toLowerCase().includes(s) ||
            String(r.rev ?? '').includes(s)
          )
          .map(r => r.id)
      )
      // Keep entire group if any row matches
      const matchingRoots = new Set<string>()
      for (const r of rows) {
        if (matchingIds.has(r.id)) {
          // find root
          let cur = r
          while (cur.parent_id && rows.find(x => x.id === cur.parent_id)) {
            cur = rows.find(x => x.id === cur.parent_id)!
          }
          matchingRoots.add(cur.id)
        }
      }
      // Keep all rows whose root matches
      filtered = rows.filter(r => {
        let cur = r
        while (cur.parent_id && rows.find(x => x.id === cur.parent_id)) {
          cur = rows.find(x => x.id === cur.parent_id)!
        }
        return matchingRoots.has(cur.id)
      })
    }

    // Filter by status
    if (filterSt) {
      const matchingRoots = new Set<string>()
      for (const r of filtered) {
        if (r.ac_co === filterSt) {
          let cur = r
          while (cur.parent_id && filtered.find(x => x.id === cur.parent_id)) {
            cur = filtered.find(x => x.id === cur.parent_id)!
          }
          matchingRoots.add(cur.id)
        }
      }
      filtered = filtered.filter(r => {
        let cur = r
        while (cur.parent_id && filtered.find(x => x.id === cur.parent_id)) {
          cur = filtered.find(x => x.id === cur.parent_id)!
        }
        return matchingRoots.has(cur.id)
      })
    }

    setAllRows(filtered)
    const g = groupRows(filtered)
    setGroups(g)
    setTotal(g.length)
    setLoading(false)
  }, [activeEl, search, filterSt, colFilters])

  useEffect(() => { fetchCounts() }, [fetchCounts])
  useEffect(() => { fetchData()  }, [fetchData])

  function setColFilter(col: string, val: string) {
    setColFilters(prev => ({ ...prev, [col]: val }))
    setOpenCol(null)
  }

  function getColOptions(col: string): string[] {
    const vals = new Set<string>()
     for (const r of allRows) {
      const v = String(((r as unknown) as Record<string,unknown>)[col] ?? '').trim()
      if (v) vals.add(v)
    }
    return Array.from(vals).sort()
  }

  async function getNextNo(): Promise<number> {
    const { data } = await supabase
      .from('concrete_pour_requests').select('no')
      .order('no', { ascending: false }).limit(1)
    return ((data?.[0]?.no ?? 0) as number) + 1
  }

  function startEdit(row: Row) {
    setEditingId(row.id)
    setEditSt(row.ac_co ?? 'P')
    setEditDate(row.approval_date ?? '')
    setEditVtime(row.v_time?.toString() ?? '')
  }

  function onEditDateChange(d: string) {
    setEditDate(d)
    const row = allRows.find(r => r.id === editingId)
    const vt = calcVtime(row?.pour_date ?? null, d)
    if (vt !== null) setEditVtime(String(vt))
  }

  async function handleSave(row: Row) {
    if (editSt === 'C') {
      setConfirmC(row)
      return
    }
    await doSave(row.id, false)
  }

  async function doSave(id: string, createRevision: boolean) {
    setSaving(true)
    const row = allRows.find(r => r.id === id)!

    if (createRevision && editSt === 'C') {
      // Archive current
      await supabase.from('concrete_pour_requests').update({
        ac_co: 'C',
        approval_date: editDate || null,
        v_time: editVtime ? Number(editVtime) : null,
        is_archived: true,
      }).eq('id', id)

      // Create new revision with empty fields for inline editing
      const nextNo  = await getNextNo()
      const nextRev = (row.rev ?? 0) + 1
      const newId   = crypto.randomUUID()
      await supabase.from('concrete_pour_requests').insert({
        id:              newId,
        no:              nextNo,
        cpr_no:          row.cpr_no ?? '',
        description:     row.description,
        rev:             nextRev,
        ac_co:           'P',
        pour_date:       today(),
        approval_date:   null,
        v_time:          null,
        remarks:         row.remarks,
        parent_id:       id,
        is_archived:     false,
        revision_count:  nextRev,
      })

    } else {
      await supabase.from('concrete_pour_requests').update({
        ac_co:         editSt,
        approval_date: editDate || null,
        v_time:        editVtime ? Number(editVtime) : null,
      }).eq('id', id)

      // Sync status to pouring_log if linked by cpr_no
      const row = allRows.find(r => r.id === id)
      if (row?.cpr_no) {
        await supabase.from('pouring_log')
          .update({ remarks: `حالة CPR: ${editSt}` })
          .eq('cpr_no', row.cpr_no)
      }
    }

    setEditingId(null); setConfirmC(null)
    setSaving(false)
    fetchData(); fetchCounts()
  }

  async function deleteRow(row: Row) {
    // Find all revisions in same group
    const group = groups.find(g => g.rows.some(r => r.id === row.id))
    const laterRevs = group?.rows.filter(r => (r.rev ?? 0) > (row.rev ?? 0)) ?? []

    // Block if this row has later revisions
    if (laterRevs.length > 0) {
      setDeleteBlockRow(row)
      setDeleteBlockRevs(laterRevs)
      setConfirmDel(null)
      return
    }

    setDeleting(true)
    await supabase.from('concrete_pour_requests').delete().eq('id', row.id)
    setConfirmDel(null); setDeleting(false)
    fetchData(); fetchCounts()
  }

  async function exportExcel() {
    let q = supabase.from('concrete_pour_requests').select('*').order('no')
    // CPR is always SC — filter by status tab
    if (activeEl !== 'ALL') q = q.eq('ac_co', activeEl)
    const { data: all } = await q
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(all ?? [])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Concrete Pour Request')
    XLSX.writeFile(wb, `concrete_pour_requests_P179.xlsx`)
  }

  return (
    <>
      <Topbar
        title="طلبات الصب — Concrete Pour Request"
        sub={`HARAJ-IQC-ALRAWAF · إجمالي ${counts.ALL ?? 0} طلب`}
        actions={<>
          
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            إضافة طلب صب
          </button>
        </>}
      />

      <div className="page-content">


        {/* Toolbar */}
        <div className="toolbar" onClick={() => setOpenCol(null)}>
          <div className="search-wrap">
            <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input placeholder="بحث سريع في جميع الحقول..." value={search}
              onChange={e => setSearch(e.target.value)}/>
          </div>
          {Object.values(colFilters).some(v => v) && (
            <button className="btn btn-ghost btn-sm" onClick={() =>
              setColFilters({ cpr_no:'', description:'', rev:'', pour_date:'', volume_m3:'', mix_design:'', ac_co:'' })
            }>
              ✕ مسح الفلاتر
            </button>
          )}
        </div>

        {/* Table */}
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">
              {activeEl === 'ALL' ? 'جميع الطلبات' : ELEMENTS.find(e=>e.key===activeEl)?.label}
            </span>
            <span className="table-meta">{total} طلب</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{width:40}}>#</th>
                  {/* Excel-style filter headers */}
                  {[
                    { key:'cpr_no',      label:'رقم CPR',        w:undefined },
                    { key:'description', label:'وصف العنصر',     w:undefined },
                    
                    { key:'rev',         label:'Rev.',            w:55 },
                    { key:'pour_date',   label:'تاريخ الصب',     w:undefined },
                    { key:'ac_co',       label:'الحالة',         w:130 },
                  ].map(col => (
                    <th key={col.key} style={col.w ? {width:col.w} : {}} onClick={e => e.stopPropagation()}>
                      <div style={{ position:'relative' }}>
                        <button
                          className={styles.colFilterBtn}
                          style={colFilters[col.key] ? { color:'var(--blue)', borderColor:'var(--blue)' } : {}}
                          onClick={() => setOpenCol(openCol === col.key ? null : col.key)}
                        >
                          {col.label}
                          {colFilters[col.key]
                            ? <span className={styles.colFilterActive}>●</span>
                            : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                          }
                        </button>
                        {openCol === col.key && (
                          <div className={styles.colDropdown} onClick={e => e.stopPropagation()}>
                            <input
                              className={styles.colSearchInput}
                              placeholder={`بحث في ${col.label}...`}
                              value={colFilters[col.key]}
                              onChange={e => setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                              autoFocus
                            />
                            <div className={styles.colOptions}>
                              <div
                                className={`${styles.colOption} ${!colFilters[col.key] ? styles.colOptionActive : ''}`}
                                onClick={() => setColFilter(col.key, '')}
                              >
                                الكل
                              </div>
                              {getColOptions(col.key).map(opt => (
                                <div
                                  key={opt}
                                  className={`${styles.colOption} ${colFilters[col.key] === opt ? styles.colOptionActive : ''}`}
                                  onClick={() => setColFilter(col.key, opt)}
                                >
                                  {opt}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                  <th style={{width:120}}>تاريخ الاعتماد</th>
                  <th style={{width:70}}>V.Time</th>
                   <th style={{width:70}}>الكمية م³</th>
                  <th style={{width:100}}>Mix Design</th>
                  <th style={{width:120 }}>إجراء</th>
                  <th style={{width:90}}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12}>
                    <div className="loading-overlay"><div className="spinner"/><span>جارٍ التحميل...</span></div>
                  </td></tr>
                ) : 
                groups.length === 0 ? (
                  <tr><td colSpan={12}>
                    <div className="empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <div className="empty-title">لا توجد طلبات صب</div>
                      <div className="empty-sub">ابدأ بإضافة طلب صب جديد أو استورد من Excel</div>
                    </div>
                  </td></tr>
                ) : groups.map((group, gi) => (
                  group.rows.map((row, ri) => {
                    const isFirst   = ri === 0
                    const isEditing = editingId === row.id
                    const stStyle   = STATUS_BG[row.ac_co] ?? STATUS_BG['P']
                    const isLast    = ri === group.rows.length - 1

                    return (
                      <tr key={row.id}
                        className={ri > 0 ? styles.revRow : ''}
                        style={{
                          borderBottom: isLast && gi < groups.length-1
                            ? '2px solid var(--border2)' : undefined
                        }}>

                        {/* # */}
                        <td className="cell-mono cell-dim">
                          {isFirst ? group.no : ''}
                        </td>

                        {/* cpr_no — show in every row */}
                        <td className="cell-mono cell-blue">
                          {row.cpr_no ?? row.request_no}
                        </td>

                        {/* description — show in every row */}
                        <td>
                          <span className="cell-desc" title={row.description}>
                            {row.description}
                          </span>
                        </td>



                        {/* Rev */}
                        <td className="cell-mono cell-muted">{row.rev}</td>

                        {/* Pour date */}
                        <td className="cell-mono cell-muted">{row.pour_date ?? '—'}</td>

                      

                        {/* mix_design */}
                        {/* <td>
                          {isEditing ? (
                            <select className="form-select" style={{ padding:'4px 8px', fontSize:11 }}
                              defaultValue={row.mix_design ?? ''}>
                              <option value="">— اختر —</option>
                              {['20 MPA OPC','25 MPA OPC','30 MPA OPC','35 MPA OPC','40 MPA OPC','20 MPA SRC','35 MPA SRC','C20','C25','C30','C35','C40'].map(m=>(
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{
                              fontSize:10, padding:'2px 7px', borderRadius:4,
                              background:'var(--bg3)', border:'1px solid var(--border)',
                              fontFamily:'var(--mono)', color:'var(--purple)', whiteSpace:'nowrap'
                            }}>
                              {row.mix_design ?? '—'}
                            </span>
                          )}
                        </td> */}

                        {/* Status — solid color like screenshot */}
                        <td style={{ padding:'6px 14px' }}>
                          {isEditing ? (
                            <select className="form-select" style={{ padding:'4px 8px', fontSize:11 }}
                              value={editSt} onChange={e => setEditSt(e.target.value)} autoFocus>
                              {STATUS_OPTS.map(s => (
                                <option key={s} value={s}>{s} — {STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{
                              display:'inline-flex', alignItems:'center', justifyContent:'center',
                              padding:'4px 12px', borderRadius:4,
                              background: stStyle.bg, color: stStyle.color,
                              fontSize:12, fontWeight:700, letterSpacing:1,
                              minWidth:28, fontFamily:'var(--mono)'
                            }}>
                              {row.ac_co}
                            </span>
                          )}
                        </td>

                        {/* Approval date */}
                        <td>
                          {isEditing ? (
                            <input type="date" className="form-input"
                              style={{ padding:'4px 8px', fontSize:11 }}
                              value={editDate} onChange={e => onEditDateChange(e.target.value)}/>
                          ) : (
                            <span className="cell-mono cell-muted">{row.approval_date ?? '—'}</span>
                          )}
                        </td>

                        {/* V.Time */}
                        <td>
                          {isEditing ? (
                            <input type="number" readOnly className="form-input"
                              style={{ padding:'4px 8px', fontSize:11, width:60, opacity:.7, cursor:'default' }}
                              value={editVtime} title="يُحسب تلقائياً"/>
                          ) : (
                            <span className="cell-mono" style={{
                              color: row.v_time == null ? 'var(--text3)'
                                   : row.v_time > 14   ? 'var(--amber)'
                                   : 'var(--green)'
                            }}>
                              {row.v_time != null ? `${row.v_time}` : '—'}
                            </span>
                          )}
                        </td>

                        {/* volume_m3 */}
                        <td className="cell-mono" style={{ color:'var(--orange)',
                           fontWeight:600 }}>
                          {row.volume_m3 != null ? `${row.volume_m3} م³` : '—'}
                        </td>
                     
                        {/* mix_design */}
                        <td>
                          {isEditing ? (
                            <select className="form-select" style={{ padding:'4px 8px', fontSize:11 }}
                              defaultValue={row.mix_design ?? ''}>
                              <option value="">— اختر —</option>
                              {['20 MPA OPC','25 MPA OPC','30 MPA OPC','35 MPA OPC','40 MPA OPC','20 MPA SRC','35 MPA SRC','C20','C25','C30','C35','C40'].map(m=>(
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{
                              fontSize:10, padding:'2px 7px', borderRadius:4,
                              background:'var(--bg3)', border:'1px solid var(--border)',
                              fontFamily:'var(--mono)', color:'var(--purple)', whiteSpace:'nowrap'
                            }}>
                              {row.mix_design ?? '—'}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td>
                          {isEditing ? (
                            <div style={{ display:'flex', gap:4 }}>
                              <button className={styles.btnSave}
                                onClick={() => handleSave(row)} disabled={saving}>
                                {saving ? '...' : '✓'}
                              </button>
                              <button className={styles.btnCancel} onClick={() => setEditingId(null)}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display:'flex', gap:4 }}>
                              <button className={styles.btnEdit} onClick={() => startEdit(row)}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                                تعديل
                              </button>
                              <button className={styles.btnDel}
                                onClick={() => setConfirmDel(row)} title="حذف">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>

                        {/* PDF Cell */}
                        <td style={{textAlign:'center', padding:'6px 8px'}}>
                          {uploadingId === row.id ? (
                            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                              <div className="spinner" style={{width:16,height:16}}/>
                              <span style={{fontSize:9,color:'var(--text3)'}}>جارٍ الرفع...</span>
                            </div>
                          ) : row.pdf_url ? (
                            <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'center'}}>
                              <button
                                onClick={() => setViewingPdf({
                                  url: getCloudinaryViewerUrl(row.pdf_url!),
                                  name: row.cpr_no ?? String(row.no),
                                  directUrl: row.pdf_url!
                                })}
                                style={{
                                  display:'inline-flex', alignItems:'center', gap:4,
                                  padding:'4px 8px', borderRadius:4,
                                  background:'#da363318', border:'1px solid #da363344',
                                  color:'var(--red)', fontSize:11, cursor:'pointer',
                                  fontFamily:'inherit', whiteSpace:'nowrap'
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                </svg>
                                عرض
                              </button>
                              {(isEditor || isAdmin) && (
                                <button
                                  onClick={async () => {
                                    if (!confirm('هل أنت متأكد من حذف ملف PDF؟')) return
                                    await fetch('/api/cloudinary-delete', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ url: row.pdf_url }),
                                    })
                                    const { error } = await supabase
                                      .from('concrete_pour_requests')
                                      .update({ pdf_url: null })
                                      .eq('id', row.id)
                                    if (error) { alert('خطأ في الحذف: ' + error.message); return }
                                    setAllRows(prev => {
                                      const next = prev.map(r => r.id===row.id ? {...r, pdf_url:null} : r)
                                      setGroups(groupRows(next))
                                      return next
                                    })
                                  }}
                                  style={{fontSize:9,color:'var(--red)',cursor:'pointer',textDecoration:'underline',
                                    background:'transparent',border:'none',fontFamily:'inherit',padding:0}}
                                >
                                  حذف
                                </button>
                              )}
                            </div>
                          ) : (isEditor || isAdmin) ? (
                            <label style={{
                              display:'inline-flex', alignItems:'center', gap:4,
                              padding:'4px 8px', borderRadius:4,
                              background:'var(--bg3)', border:'1px solid var(--border)',
                              color:'var(--text2)', fontSize:11, cursor:'pointer',
                              whiteSpace:'nowrap'
                            }} title="رفع PDF إلى Cloudinary">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="17 8 12 3 7 8"/>
                                <line x1="12" y1="3" x2="12" y2="15"/>
                              </svg>
                              رفع PDF
                              <input type="file" accept="application/pdf" style={{display:'none'}}
                                onChange={async e => {
                                  const file = e.target.files?.[0]
                                  if (!file) return
                                  setUploadingId(row.id)
                                  const { url, error } = await uploadToCloudinary(file, 'p179/concrete-pour-requests')
                                  if (error) { alert('خطأ في الرفع: ' + error); setUploadingId(null); return }
                                  await supabase.from('concrete_pour_requests').update({ pdf_url: url }).eq('id', row.id)
                                  setAllRows(prev => {
                                    const next = prev.map(r => r.id===row.id ? {...r, pdf_url:url} : r)
                                    setGroups(groupRows(next))
                                    return next
                                  })
                                  setUploadingId(null)
                                  e.target.value = ''
                                }}/>
                            </label>
                          ) : (
                            <span style={{color:'var(--text3)',fontSize:10}}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {viewingPdf && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.85)',
          zIndex:200, display:'flex', flexDirection:'column',
        }}>
          <div style={{
            height:48, background:'var(--bg2)', borderBottom:'1px solid var(--border)',
            display:'flex', alignItems:'center', gap:12, padding:'0 16px', flexShrink:0
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span style={{fontSize:13, fontWeight:600, color:'var(--text)', flex:1}}>
              {viewingPdf.name}
            </span>
            <a
              href={viewingPdf.directUrl ?? viewingPdf.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:'inline-flex', alignItems:'center', gap:6,
                padding:'6px 12px', borderRadius:6,
                background:'var(--accent)', color:'#fff',
                fontSize:12, textDecoration:'none'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              تنزيل
            </a>
            <button
              onClick={() => setViewingPdf(null)}
              style={{
                background:'transparent', border:'1px solid var(--border)',
                borderRadius:6, padding:'6px 12px',
                color:'var(--text2)', cursor:'pointer', fontSize:12
              }}
            >
              ✕ إغلاق
            </button>
          </div>
          <iframe
            src={viewingPdf.url}
            style={{ flex:1, border:'none', width:'100%' }}
            title="PDF Viewer"
          />
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <AddRecordModal
          table="concrete_pour_requests" title="إضافة طلب صب جديد"
          fields={FIELDS} onClose={() => setShowAdd(false)}
          onSaved={async () => {
            // Get the last inserted CPR row
            const { data: last } = await supabase
              .from('concrete_pour_requests')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1)
            /*  */
            // if (last?.[0]) {
            //   const cpr = last[0]
            //   // Get next pouring_log no
            //   const { data: lastLog } = await supabase
            //     .from('pouring_log')
            //     .select('no')
            //     .order('no', { ascending: false })
            //     .limit(1)
            //   const nextNo = ((lastLog?.[0]?.no ?? 0) as number) + 1

            //   // Build description from CPR data
            //   const desc = [
            //     cpr.description,
            //     cpr.mix_design,
            //   ].filter(Boolean).join(' — ')

            //   await supabase.from('pouring_log').insert({
            //     no:            nextNo,
                
            //     cast_date:     cpr.pour_date ?? null,
            //     cpr_no:        cpr.cpr_no ?? null,
            //     description:   desc || cpr.description || null,
            //     grade:         cpr.mix_design ?? null,
            //     quantity_m3:   cpr.volume_m3 ?? null,
            //     remarks:       cpr.remarks ?? null,
            //   })
            // }

            fetchData(); fetchCounts()
          }}
          autoNumber={{ field:'no', getNext: getNextNo }}
          onSaveAndGenerate={record => generateForm({ docType:'CPR', titleAr:'طلب صب خرساني', fields:FIELDS, record })}
        />
      )}

      {/* Confirm C — simple confirm, editing happens inline in table */}
      {confirmC && (
        <div className="modal-overlay">
          <div className="modal" style={{ width:440 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color:'var(--amber)' }}>
                ⚠ تأكيد: مراجعة وإعادة تقديم
              </div>
            </div>
            <div style={{
              background:'var(--bg3)', border:'1px solid #9e6a0333',
              borderRadius:'var(--radius)', padding:16, marginBottom:20, fontSize:12,
            }}>
              <div style={{ color:'var(--text2)', marginBottom:12 }}>
                سيُؤرشف الطلب الحالي بحالة C وتُضاف مراجعة جديدة في الجدول مباشرة:
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={{ background:'#da363318', border:'1px solid #da363333',
                  borderRadius:'var(--radius-sm)', padding:'8px 12px' }}>
                  <div style={{ color:'var(--text3)', fontSize:10, marginBottom:4 }}>يُؤرشف</div>
                  <div style={{ fontFamily:'var(--mono)', color:'var(--red)', fontWeight:700 }}>
                    REV.{confirmC.rev}
                  </div>
                  <div style={{ color:'var(--text3)', fontSize:11, marginTop:2 }}>حالة C</div>
                </div>
                <div style={{ background:'#3fb95018', border:'1px solid #3fb95033',
                  borderRadius:'var(--radius-sm)', padding:'8px 12px' }}>
                  <div style={{ color:'var(--text3)', fontSize:10, marginBottom:4 }}>يُنشأ في الجدول</div>
                  <div style={{ fontFamily:'var(--mono)', color:'var(--green)', fontWeight:700 }}>
                    REV.{(confirmC.rev??0)+1}
                  </div>
                  <div style={{ color:'var(--text3)', fontSize:11, marginTop:2 }}>
                    قابل للتعديل مباشرة
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost"
                onClick={() => { setConfirmC(null); setEditingId(null) }}>
                إلغاء
              </button>
              <button className="btn btn-ghost"
                style={{ borderColor:'var(--amber)', color:'var(--amber)' }}
                onClick={() => doSave(confirmC.id, false)}>
                حفظ C فقط
              </button>
              <button className="btn btn-primary"
                onClick={() => doSave(confirmC.id, true)} disabled={saving}>
                {saving ? <span className="spinner"/> : '✓ إنشاء مراجعة في الجدول'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Blocked — has later revisions */}
      {deleteBlockRow && (
        <div className="modal-overlay">
          <div className="modal" style={{ width:460 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color:'var(--red)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ display:'inline', verticalAlign:'middle', marginLeft:8 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                لا يمكن الحذف
              </div>
            </div>

            {/* Warning message */}
            <div style={{
              background:'#da363318', border:'1px solid #da363344',
              borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:20,
              fontSize:13, color:'var(--text)',
            }}>
              الطلب
              <span style={{ fontFamily:'var(--mono)', color:'var(--blue)', margin:'0 6px' }}>
                REV.{deleteBlockRow.rev}
              </span>
              مرتبط بمراجعات لاحقة ولا يمكن حذفه.
            </div>

            {/* List of blocking revisions */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10,
                textTransform:'uppercase', letterSpacing:'.06em', fontWeight:600 }}>
                المراجعات المرتبطة
              </div>
              {deleteBlockRevs.map(r => (
                <div key={r.id} style={{
                  display:'flex', alignItems:'center', gap:12,
                  background:'var(--bg3)', border:'1px solid var(--border)',
                  borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:6,
                }}>
                  <span style={{
                    fontFamily:'var(--mono)', fontWeight:700, fontSize:13,
                    color: r.ac_co === 'B' || r.ac_co === 'A' ? 'var(--green)'
                         : r.ac_co === 'C' ? 'var(--amber)' : 'var(--text2)',
                  }}>
                    REV.{r.rev}
                  </span>
                  <span style={{
                    display:'inline-flex', alignItems:'center',
                    padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                    background: r.ac_co === 'B' || r.ac_co === 'A' ? '#1a7f37'
                              : r.ac_co === 'C' ? '#da3633' : '#444',
                    color:'#fff',
                  }}>{r.ac_co}</span>
                  <span style={{ fontSize:12, color:'var(--text2)', flex:1 }}>
                    {r.submission_date ?? '—'}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:20 }}>
              💡 لحذف هذا الطلب احذف المراجعات الأحدث أولاً بالترتيب من الأعلى.
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button className="btn btn-primary" onClick={() => {
                setDeleteBlockRow(null); setDeleteBlockRevs([])
              }}>
                حسناً، فهمت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDel && (
        <div className="modal-overlay">
          <div className="modal" style={{ width:420 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color:'var(--red)' }}>تأكيد الحذف</div>
            </div>
            <div style={{ background:'var(--bg3)', border:'1px solid #da363333',
              borderRadius:'var(--radius)', padding:16, marginBottom:20 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--blue)', marginBottom:4 }}>
                {confirmDel.cpr_no ?? confirmDel.request_no}
              </div>
              <div style={{ fontSize:13, marginBottom:8 }}>{confirmDel.description}</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>
                REV.{confirmDel.rev}  · {confirmDel.ac_co}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>إلغاء</button>
              <button style={{ background:'#da363322', color:'var(--red)', border:'1px solid #da363344',
                borderRadius:'var(--radius-sm)', padding:'7px 14px', fontSize:12, cursor:'pointer',
                fontFamily:'inherit' }}
                onClick={() => deleteRow(confirmDel)} disabled={deleting}>
                {deleting ? <span className="spinner"/> : 'حذف نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
