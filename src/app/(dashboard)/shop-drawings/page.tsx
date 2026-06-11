
'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/layout/Topbar'
import AddRecordModal from '@/components/forms/AddRecordModal'
import type { FieldDef } from '@/components/forms/AddRecordModal'
import styles from './page.module.css'
import { useRole } from '@/lib/hooks/useRole'

// ── Helpers ──────────────────────────────────────────────────────
function calcVtime(sub: string | null, app: string | null): number | null {
  if (!sub || !app) return null
  const diff = new Date(app).getTime() - new Date(sub).getTime()
  return diff < 0 ? null : Math.round(diff / 86400000)
}
function today(): string { return new Date().toISOString().slice(0, 10) }

// ── Constants ────────────────────────────────────────────────────
const ELEMENTS = [
  { key:'ALL', label:'الكل',     color:'#8b949e' },
  { key:'ARC',  label:'معماري',   color:'#4caf50' },
  { key:'CIV',  label:'إنشائي',   color:'#64b5f6' },
  { key:'SUR',  label:'مساحة',    color:'#ffb74d' },
  { key:'MEC',  label:'ميكانيكي', color:'#ce93d8' },
  { key:'ELE',  label:'كهربائي',  color:'#ef9a9a' },
  { key:'GEN', label:'عام',      color:'#8b949e' },
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
const EL_COLOR: Record<string,string> = {
  ARC:'el-ar', CIV:'el-sc', SUR:'el-su', MEC:'el-me', ELE:'el-el', GEN:'el-gen'
}

const FIELDS: FieldDef[] = [
  { key:'request_no',     label:'رقم الطلب',      type:'text',   required:true },
  { key:'description',    label:'وصف الرسم',      type:'text',   required:true },
  { key:'element',        label:'العنصر',         type:'select', required:true, options:['ARC','CIV','SUR','MEC','ELE','GEN'] },
  { key:'rev',            label:'رقم المراجعة',   type:'number' },
  { key:'submission_date',label:'تاريخ التقديم',  type:'date' },
  { key:'ac_co',          label:'حالة الاعتماد',  type:'select', options:['A','B','C','D','P'] },
  { key:'approval_date',  label:'تاريخ الاعتماد', type:'date' },
  { key:'v_time',         label:'V.Time (أيام)',  type:'number' },
  { key:'remarks',        label:'ملاحظات',        type:'textarea' },
]

const PG = 20

interface Row {
  id: string
  no: number
  request_no: string
  description: string
  element: string
  rev: number
  ac_co: string
  submission_date: string | null
  approval_date: string | null
  v_time: number | null
  remarks: string | null
  parent_id: string | null
  is_archived: boolean
  revision_count: number
}

// Group rows: each group = root row + all its revisions
interface Group {
  root_request_no: string
  rows: Row[]          // sorted by rev asc
  no: number           // display number (from first row)
  description: string
  element: string
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
      root_request_no: root.request_no,
      rows: sorted,
      no:          root.no,
      description: root.description,
      element:     root.element,
    }
  }).sort((a,b) => a.no - b.no)
}

export default function ShopDrawingsPage() {
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
    request_no: '', description: '', element: '', submission_date: '', ac_co: '', rev: ''
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

  const [confirmDel, setConfirmDel]       = useState<Row|null>(null)
  const [deleting, setDeleting]           = useState(false)
  const [deleteBlockRow, setDeleteBlockRow] = useState<Row|null>(null)
  const [deleteBlockRevs, setDeleteBlockRevs] = useState<Row[]>([])

  // Fetch counts (only root/non-archived for tab counts)
  const fetchCounts = useCallback(async () => {
    // Fetch all rows with id and parent_id to find roots only
    const { data } = await supabase
      .from('shop_drawings')
      .select('id, parent_id, element')
    if (!data) return

    const rows = data as { id: string; parent_id: string | null; element: string }[]

    // Count only root rows (no parent_id = original drawing, not a revision)
    const c: Record<string, number> = { ALL: 0 }
    for (const r of rows) {
      if (!r.parent_id) {
        c['ALL'] = (c['ALL'] ?? 0) + 1
        c[r.element] = (c[r.element] ?? 0) + 1
      }
    }
    setCounts(c)
  }, [])

  // Fetch ALL rows (including archived) to group them
  const fetchData = useCallback(async () => {
    setLoading(true)

    // Fetch all rows for grouping
    let q = supabase
      .from('shop_drawings')
      .select('*')
      .order('request_no', { ascending: true })
      .order('rev', { ascending: true })

    if (activeEl !== 'ALL') q = q.eq('element', activeEl)

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
            (r.request_no      ?? '').toLowerCase().includes(s) ||
            (r.description     ?? '').toLowerCase().includes(s) ||
            (r.element         ?? '').toLowerCase().includes(s) ||
            (r.ac_co           ?? '').toLowerCase().includes(s) ||
            (r.submission_date ?? '').toLowerCase().includes(s) ||
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
      .from('shop_drawings').select('no')
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
    const vt = calcVtime(row?.submission_date ?? null, d)
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
      await supabase.from('shop_drawings').update({
        ac_co: 'C',
        approval_date: editDate || null,
        v_time: editVtime ? Number(editVtime) : null,
        is_archived: true,
      }).eq('id', id)

      // Create new revision with empty fields for inline editing
      const nextNo  = await getNextNo()
      const nextRev = (row.rev ?? 0) + 1
      const newId   = crypto.randomUUID()
      await supabase.from('shop_drawings').insert({
        id:              newId,
        no:              nextNo,
        request_no:      row.request_no,
        description:     row.description,
        element:         row.element,
        rev:             nextRev,
        ac_co:           'P',
        submission_date: today(),
        approval_date:   null,
        v_time:          null,
        remarks:         row.remarks,
        parent_id:       id,
        is_archived:     false,
        revision_count:  nextRev,
      })

    } else {
      await supabase.from('shop_drawings').update({
        ac_co:         editSt,
        approval_date: editDate || null,
        v_time:        editVtime ? Number(editVtime) : null,
      }).eq('id', id)
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
    await supabase.from('shop_drawings').delete().eq('id', row.id)
    setConfirmDel(null); setDeleting(false)
    fetchData(); fetchCounts()
  }

  async function exportExcel() {
    let q = supabase.from('shop_drawings').select('*').order('no')
    if (activeEl !== 'ALL') q = q.eq('element', activeEl)
    const { data: all } = await q
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(all ?? [])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Shop Drawings')
    XLSX.writeFile(wb, `shop_drawings_P179.xlsx`)
  }

  return (
    <>
      <Topbar
        title="رسومات التنفيذ — Shop Drawing Submittal"
        sub={`MURCIA-2 Zone 06 · إجمالي ${counts.ALL ?? 0} رسم`}
        actions={<>
          {/* {isAdmin && <button className="btn btn-ghost btn-sm" onClick={exportExcel}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            تصدير Excel
          </button>} */}
          {isEditor && <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            إضافة رسم
          </button>}
        </>}
      />

      <div className="page-content">

        {/* Element Tabs */}
        <div className={styles.tabs}>
          {ELEMENTS.map(el => (
            <button key={el.key}
              className={`${styles.tab} ${activeEl === el.key ? styles.tabActive : ''}`}
              onClick={() => { setActiveEl(el.key) }}
              style={activeEl === el.key ? { borderColor: el.color, color: el.color } : {}}>
              <span className={styles.tabDot} style={{ background: el.color }}/>
              {el.label}
              <span className={styles.tabCount}>{counts[el.key] ?? 0}</span>
            </button>
          ))}
        </div>

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
              setColFilters({ request_no:'', description:'', element:'', submission_date:'', ac_co:'', rev:'' })
            }>
              ✕ مسح الفلاتر
            </button>
          )}
        </div>

        {/* Table */}
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">
              {activeEl === 'ALL' ? 'جميع العناصر' : ELEMENTS.find(e=>e.key===activeEl)?.label}
            </span>
            <span className="table-meta">{total} رسم</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{width:40}}>#</th>
                  {/* Excel-style filter headers */}
                  {[
                    { key:'request_no',     label:'رقم الطلب',       w:undefined },
                    { key:'description',    label:'وصف الرسم',       w:undefined },
                    { key:'element',        label:'العنصر',          w:70 },
                    { key:'rev',            label:'Rev.',             w:55 },
                    { key:'submission_date',label:'تاريخ التقديم',   w:undefined },
                    { key:'ac_co',          label:'الحالة',          w:160 },
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
                  <th>تاريخ الاعتماد</th>
                  <th style={{width:70}}>V.Time</th>
                  <th style={{width:120}}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10}>
                    <div className="loading-overlay"><div className="spinner"/><span>جارٍ التحميل...</span></div>
                  </td></tr>
                ) : groups.length === 0 ? (
                  <tr><td colSpan={10}>
                    <div className="empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <div className="empty-title">لا توجد رسومات</div>
                      <div className="empty-sub">ابدأ بإضافة رسم جديد أو استورد من Excel</div>
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

                        {/* request_no — show in every row */}
                        <td className="cell-mono cell-blue">
                          {row.request_no}
                        </td>

                        {/* description — show in every row */}
                        <td>
                          <span className="cell-desc" title={row.description}>
                            {row.description}
                          </span>
                        </td>

                        {/* element — show in every row */}
                        <td>
                          <span className={`el-badge ${EL_COLOR[row.element]??'el-gen'}`}>{row.element}</span>
                        </td>

                        {/* Rev */}
                        <td className="cell-mono cell-muted">{row.rev}</td>

                        {/* Submission date */}
                        <td className="cell-mono cell-muted">{row.submission_date ?? '—'}</td>

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
                              {isEditor && 
                              <>
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
                              </button></>
                              }
                            </div>
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

      {/* Add Modal */}
      {showAdd && (
        <AddRecordModal
          table="shop_drawings" title="إضافة رسم تنفيذ جديد"
          fields={FIELDS} onClose={() => setShowAdd(false)}
          onSaved={() => { fetchData(); fetchCounts() }}
          autoNumber={{ field:'no', getNext: getNextNo }}
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
                سيُؤرشف الرسم الحالي بحالة C وتُضاف مراجعة جديدة في الجدول مباشرة:
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
              الرسم
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
              💡 لحذف هذا الرسم احذف المراجعات الأحدث أولاً بالترتيب من الأعلى.
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
                {confirmDel.request_no}
              </div>
              <div style={{ fontSize:13, marginBottom:8 }}>{confirmDel.description}</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>
                REV.{confirmDel.rev} · {confirmDel.element} · {confirmDel.ac_co}
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
