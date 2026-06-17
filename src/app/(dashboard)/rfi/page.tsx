'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/layout/Topbar'
import { useRole } from '@/lib/hooks/useRole'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import AddRecordModal from '@/components/forms/AddRecordModal'
import type { FieldDef } from '@/components/forms/AddRecordModal'
import styles from '@/app/(dashboard)/dashboard.module.css'
import { generateForm } from '@/lib/utils/generateForm'
import { uploadToCloudinary, getCloudinaryViewerUrl } from '@/lib/utils/cloudinary'

function calcVtime(sub: string | null, app: string | null): number | null {
  if (!sub || !app) return null
  const diff = new Date(app).getTime() - new Date(sub).getTime()
  return diff < 0 ? null : Math.round(diff / 86400000)
}
function today(): string { return new Date().toISOString().slice(0, 10) }

const ELEMENT_COLORS = [
  { key:'ALL', color:'#8b949e' },
  { key:'ARC', color:'#4caf50' },
  { key:'CIV', color:'#64b5f6' },
  { key:'SUR', color:'#ffb74d' },
  { key:'MEC', color:'#ce93d8' },
  { key:'ELE', color:'#ef9a9a' },
  { key:'GEN', color:'#8b949e' },
]

const STATUS_OPTS = ['A','B','C','D','P']
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

const RFI_PREFIX: Record<string,string> = {
  ARC:'J500-RWF-RFI-ARC-',
  CIV:'J500-RWF-RFI-CIV-',
  SUR:'J500-RWF-RFI-SUR-',
  MEC:'J500-RWF-RFI-MEC-',
  ELE:'J500-RWF-RFI-ELE-',
  GEN:'J500-RWF-RFI-GEN-',
}

interface Row {
  id: string
  no: number
  rfi_no: string
  subject: string
  question: string | null
  answer: string | null
  submission_date: string | null
  response_date: string | null
  remarks: string | null
  parent_id: string | null
  is_archived: boolean
  revision_count: number
  rev: number
  element: string
  ac_co: string
  approval_date: string | null
  v_time: number | null
  request_no?: string
  description?: string
  pdf_url: string | null
}

interface Group {
  root_request_no: string
  rows: Row[]
  no: number
  description: string
  element: string
}

function groupRows(rows: Row[]): Group[] {
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
      root_request_no: root.rfi_no ?? '',
      description: root.subject ?? '',
      rows: sorted,
      no:      root.no,
      element: root.element,
    }
  }).sort((a,b) => a.no - b.no)
}

export default function RfiPage() {
  const supabase = createClient()
  const { isAdmin, isEditor } = useRole()
  const { t } = useLanguage()
  const d = t.docs
  const p = t.pages.rfi

  const ELEMENTS = useMemo(() => ELEMENT_COLORS.map(e => ({
    key: e.key, color: e.color,
    label: d.elements[e.key as keyof typeof d.elements] ?? e.key,
  })), [d])

  const STATUS_LABELS: Record<string,string> = useMemo(() => ({ ...d.statusLabels }), [d])

  const FIELDS = useMemo<FieldDef[]>(() => [
    { key:'element',         label: d.fields.element,        type:'select', required:true,
      options:['ARC','CIV','SUR','MEC','ELE','GEN'] },
    { key:'rfi_no',          label: p.rfiNoField,            type:'text',   required:true,
      prefixDynamic:{ fromField:'element', map:RFI_PREFIX } },
    { key:'subject',         label: p.subjectField,          type:'text',   required:true },
    { key:'submission_date', label: d.fields.submissionDate, type:'date',   required:true },
    { key:'rev',             label: d.fields.rev,            type:'number' },
    { key:'ac_co',           label: d.fields.status,         type:'select', defaultValue:'P',
      options:['A','B','C','D','P'] },
    { key:'approval_date',   label: d.fields.approvalDate,   type:'date' },
    { key:'v_time',          label: d.fields.vtime,          type:'number' },
    { key:'remarks',         label: d.fields.remarks,        type:'textarea' },
  ], [d, p])

  const [activeEl, setActiveEl]     = useState('ALL')
  const [allRows, setAllRows]       = useState<Row[]>([])
  const [groups, setGroups]         = useState<Group[]>([])
  const [total, setTotal]           = useState(0)
  const [counts, setCounts]         = useState<Record<string,number>>({})
  const [search, setSearch]         = useState('')
  const [filterSt, setFilterSt]     = useState('')
  const [colFilters, setColFilters] = useState<Record<string,string>>({
    rfi_no: '', subject: '', element: '', submission_date: '', ac_co: '', rev: ''
  })
  const [openCol, setOpenCol]       = useState<string|null>(null)
  const [loading, setLoading]       = useState(true)
  const [showAdd, setShowAdd]       = useState(false)

  const [editingId, setEditingId]   = useState<string|null>(null)
  const [editSt, setEditSt]         = useState('')
  const [editDate, setEditDate]     = useState('')
  const [editVtime, setEditVtime]   = useState('')
  const [saving, setSaving]         = useState(false)

  const [confirmC, setConfirmC]           = useState<Row|null>(null)
  const [confirmDel, setConfirmDel]       = useState<Row|null>(null)
  const [deleting, setDeleting]           = useState(false)
  const [deleteBlockRow, setDeleteBlockRow] = useState<Row|null>(null)
  const [deleteBlockRevs, setDeleteBlockRevs] = useState<Row[]>([])
  const [uploadingId, setUploadingId]     = useState<string|null>(null)
  const [viewingPdf, setViewingPdf]       = useState<{url:string;name:string;directUrl?:string}|null>(null)

  // suppress unused filterSt warning (kept for future use)
  void filterSt

  const fetchCounts = useCallback(async () => {
    const { data } = await supabase.from('requests_for_information').select('id, parent_id, element')
    if (!data) return
    const rows = data as { id: string; parent_id: string | null; element: string }[]
    const c: Record<string, number> = { ALL: 0 }
    for (const r of rows) {
      if (!r.parent_id) {
        c['ALL'] = (c['ALL'] ?? 0) + 1
        c[r.element] = (c[r.element] ?? 0) + 1
      }
    }
    setCounts(c)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('requests_for_information').select('*')
      .order('request_no', { ascending: true })
      .order('rev', { ascending: true })
    if (activeEl !== 'ALL') q = q.eq('element', activeEl)
    const { data } = await q
    const rows = (data ?? []) as Row[]
    const s = search.toLowerCase().trim()
    let filtered = rows

    filtered = filtered.filter(r => {
      for (const [col, val] of Object.entries(colFilters)) {
        if (!val) continue
        const rv = String((r as unknown as Record<string,unknown>)[col] ?? '').toLowerCase()
        if (!rv.includes(String(val).toLowerCase())) return false
      }
      return true
    })

    if (s) {
      const matchingIds = new Set(
        rows.filter(r =>
          (r.rfi_no          ?? '').toLowerCase().includes(s) ||
          (r.subject         ?? '').toLowerCase().includes(s) ||
          (r.element         ?? '').toLowerCase().includes(s) ||
          (r.ac_co           ?? '').toLowerCase().includes(s) ||
          (r.submission_date ?? '').toLowerCase().includes(s) ||
          (r.question        ?? '').toLowerCase().includes(s) ||
          String(r.rev ?? '').includes(s)
        ).map(r => r.id)
      )
      const matchingRoots = new Set<string>()
      for (const r of rows) {
        if (matchingIds.has(r.id)) {
          let cur = r
          while (cur.parent_id && rows.find(x => x.id === cur.parent_id))
            cur = rows.find(x => x.id === cur.parent_id)!
          matchingRoots.add(cur.id)
        }
      }
      filtered = rows.filter(r => {
        let cur = r
        while (cur.parent_id && rows.find(x => x.id === cur.parent_id))
          cur = rows.find(x => x.id === cur.parent_id)!
        return matchingRoots.has(cur.id)
      })
    }

    setAllRows(filtered)
    const g = groupRows(filtered)
    setGroups(g)
    setTotal(g.length)
    setLoading(false)
  }, [activeEl, search, colFilters])

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
    const { data } = await supabase.from('requests_for_information').select('no')
      .order('no', { ascending: false }).limit(1)
    return ((data?.[0]?.no ?? 0) as number) + 1
  }

  function startEdit(row: Row) {
    setEditingId(row.id)
    setEditSt(row.ac_co ?? 'P')
    setEditDate(row.approval_date ?? '')
    setEditVtime(row.v_time?.toString() ?? '')
  }

  function onEditDateChange(dt: string) {
    setEditDate(dt)
    const row = allRows.find(r => r.id === editingId)
    const vt = calcVtime(row?.submission_date ?? null, dt)
    if (vt !== null) setEditVtime(String(vt))
  }

  async function handleSave(row: Row) {
    if (editSt === 'C') { setConfirmC(row); return }
    await doSave(row.id, false)
  }

  async function doSave(id: string, createRevision: boolean) {
    setSaving(true)
    const row = allRows.find(r => r.id === id)!
    if (createRevision && editSt === 'C') {
      await supabase.from('requests_for_information').update({
        ac_co: 'C', approval_date: editDate || null,
        v_time: editVtime ? Number(editVtime) : null, is_archived: true,
      }).eq('id', id)
      const nextNo  = await getNextNo()
      const nextRev = (row.rev ?? 0) + 1
      await supabase.from('requests_for_information').insert({
        id: crypto.randomUUID(), no: nextNo,
        rfi_no: row.rfi_no, subject: row.subject,
        element: row.element, rev: nextRev, ac_co: 'P',
        submission_date: today(), approval_date: null, v_time: null,
        remarks: row.remarks, parent_id: id, is_archived: false, revision_count: nextRev,
      })
    } else {
      await supabase.from('requests_for_information').update({
        ac_co: editSt, approval_date: editDate || null,
        v_time: editVtime ? Number(editVtime) : null,
      }).eq('id', id)
    }
    setEditingId(null); setConfirmC(null); setSaving(false)
    fetchData(); fetchCounts()
  }

  async function deleteRow(row: Row) {
    const group = groups.find(g => g.rows.some(r => r.id === row.id))
    const laterRevs = group?.rows.filter(r => (r.rev ?? 0) > (row.rev ?? 0)) ?? []
    if (laterRevs.length > 0) {
      setDeleteBlockRow(row); setDeleteBlockRevs(laterRevs); setConfirmDel(null); return
    }
    setDeleting(true)
    await supabase.from('requests_for_information').delete().eq('id', row.id)
    setConfirmDel(null); setDeleting(false)
    fetchData(); fetchCounts()
  }

  const COL_HEADERS = useMemo(() => [
    { key:'rfi_no',          label: p.rfiNoField,           w: undefined },
    { key:'subject',         label: p.subjectCol,           w: undefined },
    { key:'element',         label: d.cols.element,         w: 70 },
    { key:'rev',             label: d.cols.rev,             w: 55 },
    { key:'submission_date', label: d.cols.submissionDate,  w: undefined },
    { key:'ac_co',           label: d.cols.status,          w: 160 },
  ], [d, p])

  return (
    <>
      <Topbar
        title={p.title}
        sub={p.sub.replace('{n}', String(counts.ALL ?? 0))}
        actions={<>
          {isEditor && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {p.addBtn}
            </button>
          )}
        </>}
      />

      <div className="page-content">
        {/* Element Tabs */}
        <div className={styles.tabs}>
          {ELEMENTS.map(el => (
            <button key={el.key}
              className={`${styles.tab} ${activeEl === el.key ? styles.tabActive : ''}`}
              onClick={() => setActiveEl(el.key)}
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
            <input placeholder={d.searchAll} value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          {Object.values(colFilters).some(v => v) && (
            <button className="btn btn-ghost btn-sm" onClick={() =>
              setColFilters({ rfi_no:'', subject:'', element:'', submission_date:'', ac_co:'', rev:'' })
            }>✕ {d.clearFilters}</button>
          )}
        </div>

        {/* Table */}
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">
              {activeEl === 'ALL' ? d.allElements : ELEMENTS.find(e=>e.key===activeEl)?.label}
            </span>
            <span className="table-meta">{total} {p.unit}</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{width:40}}>#</th>
                  {COL_HEADERS.map(col => (
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
                            : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                          }
                        </button>
                        {openCol === col.key && (
                          <div className={styles.colDropdown} onClick={e => e.stopPropagation()}>
                            <input className={styles.colSearchInput}
                              placeholder={`${col.label}...`}
                              value={colFilters[col.key]}
                              onChange={e => setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                              autoFocus/>
                            <div className={styles.colOptions}>
                              <div className={`${styles.colOption} ${!colFilters[col.key] ? styles.colOptionActive : ''}`}
                                onClick={() => setColFilter(col.key, '')}>{d.elements.ALL}</div>
                              {getColOptions(col.key).map(opt => (
                                <div key={opt} className={`${styles.colOption} ${colFilters[col.key] === opt ? styles.colOptionActive : ''}`}
                                  onClick={() => setColFilter(col.key, opt)}>{opt}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                  <th>{d.cols.approvalDate}</th>
                  <th style={{width:70}}>{d.cols.vtime}</th>
                  <th style={{width:120}}>{d.cols.action}</th>
                  <th style={{width:90}}>{d.cols.pdf}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11}>
                    <div className="loading-overlay"><div className="spinner"/><span>{t.common.loading}</span></div>
                  </td></tr>
                ) : groups.length === 0 ? (
                  <tr><td colSpan={11}>
                    <div className="empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <div className="empty-title">{p.empty}</div>
                      <div className="empty-sub">{p.emptySub}</div>
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
                        style={{ borderBottom: isLast && gi < groups.length-1 ? '2px solid var(--border2)' : undefined }}>
                        <td className="cell-mono cell-dim">{isFirst ? group.no : ''}</td>
                        <td className="cell-mono cell-blue">{row.rfi_no}</td>
                        <td><span className="cell-desc" title={row.subject}>{row.subject}</span></td>
                        <td><span className={`el-badge ${EL_COLOR[row.element]??'el-gen'}`}>{row.element}</span></td>
                        <td className="cell-mono cell-muted">{row.rev}</td>
                        <td className="cell-mono cell-muted">{row.submission_date ?? '—'}</td>
                        <td style={{ padding:'6px 14px' }}>
                          {isEditing ? (
                            <select className="form-select" style={{ padding:'4px 8px', fontSize:11 }}
                              value={editSt} onChange={e => setEditSt(e.target.value)} autoFocus>
                              {STATUS_OPTS.map(s => <option key={s} value={s}>{s} — {STATUS_LABELS[s]}</option>)}
                            </select>
                          ) : (
                            <span style={{
                              display:'inline-flex', alignItems:'center', justifyContent:'center',
                              padding:'4px 12px', borderRadius:4,
                              background: stStyle.bg, color: stStyle.color,
                              fontSize:12, fontWeight:700, letterSpacing:1,
                              minWidth:28, fontFamily:'var(--mono)'
                            }}>{row.ac_co}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input type="date" className="form-input" style={{ padding:'4px 8px', fontSize:11 }}
                              value={editDate} onChange={e => onEditDateChange(e.target.value)}/>
                          ) : <span className="cell-mono cell-muted">{row.approval_date ?? '—'}</span>}
                        </td>
                        <td>
                          {isEditing ? (
                            <input type="number" readOnly className="form-input"
                              style={{ padding:'4px 8px', fontSize:11, width:60, opacity:.7, cursor:'default' }}
                              value={editVtime} title={d.vtimeAuto}/>
                          ) : (
                            <span className="cell-mono" style={{ color: row.v_time == null ? 'var(--text3)' : row.v_time > 14 ? 'var(--amber)' : 'var(--green)' }}>
                              {row.v_time != null ? `${row.v_time}` : '—'}
                            </span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={{ display:'flex', gap:4 }}>
                              <button className={styles.btnSave} onClick={() => handleSave(row)} disabled={saving}>
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
                                {t.common.edit}
                              </button>
                              <button className={styles.btnDel} onClick={() => setConfirmDel(row)} title={t.common.delete}>
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
                              <span style={{fontSize:9,color:'var(--text3)'}}>{d.pdf.uploading}</span>
                            </div>
                          ) : row.pdf_url ? (
                            <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'center'}}>
                              <button
                                onClick={() => setViewingPdf({ url: getCloudinaryViewerUrl(row.pdf_url!), name: row.rfi_no ?? String(row.no), directUrl: row.pdf_url! })}
                                style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 8px', borderRadius:4, background:'#da363318', border:'1px solid #da363344', color:'var(--red)', fontSize:11, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                </svg>
                                {t.common.view}
                              </button>
                              {(isEditor || isAdmin) && (
                                <button onClick={async () => {
                                  if (!confirm(d.pdf.deleteConfirm)) return
                                  await fetch('/api/cloudinary-delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: row.pdf_url }) })
                                  const { error } = await supabase.from('requests_for_information').update({ pdf_url: null }).eq('id', row.id)
                                  if (error) { alert(d.pdf.deleteErr + error.message); return }
                                  setAllRows(prev => { const next = prev.map(r => r.id===row.id ? {...r, pdf_url:null} : r); setGroups(groupRows(next)); return next })
                                }} style={{fontSize:9,color:'var(--red)',cursor:'pointer',textDecoration:'underline',background:'transparent',border:'none',fontFamily:'inherit',padding:0}}>
                                  {t.common.delete}
                                </button>
                              )}
                            </div>
                          ) : (isEditor || isAdmin) ? (
                            <label style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 8px', borderRadius:4, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)', fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }} title={t.common.upload}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="17 8 12 3 7 8"/>
                                <line x1="12" y1="3" x2="12" y2="15"/>
                              </svg>
                              {t.common.upload}
                              <input type="file" accept="application/pdf" style={{display:'none'}}
                                onChange={async e => {
                                  const file = e.target.files?.[0]; if (!file) return
                                  setUploadingId(row.id)
                                  const { url, error } = await uploadToCloudinary(file, 'p179/rfi')
                                  if (error) { alert(d.pdf.uploadErr + error); setUploadingId(null); return }
                                  await supabase.from('requests_for_information').update({ pdf_url: url }).eq('id', row.id)
                                  setAllRows(prev => { const next = prev.map(r => r.id===row.id ? {...r, pdf_url:url} : r); setGroups(groupRows(next)); return next })
                                  setUploadingId(null); e.target.value = ''
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

      {/* PDF Viewer */}
      {viewingPdf && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:200, display:'flex', flexDirection:'column' }}>
          <div style={{ height:48, background:'var(--bg2)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, padding:'0 16px', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span style={{fontSize:13, fontWeight:600, color:'var(--text)', flex:1}}>{viewingPdf.name}</span>
            <a href={viewingPdf.directUrl ?? viewingPdf.url} target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:6, background:'var(--accent)', color:'#fff', fontSize:12, textDecoration:'none' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {t.common.download}
            </a>
            <button onClick={() => setViewingPdf(null)}
              style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:6, padding:'6px 12px', color:'var(--text2)', cursor:'pointer', fontSize:12 }}>
              ✕ {d.pdf.closeViewer}
            </button>
          </div>
          <iframe src={viewingPdf.url} style={{ flex:1, border:'none', width:'100%' }} title={d.pdf.viewerTitle}/>
        </div>
      )}

      {showAdd && (
        <AddRecordModal table="requests_for_information" title={p.addBtn}
          fields={FIELDS} onClose={() => setShowAdd(false)}
          onSaved={() => { fetchData(); fetchCounts() }}
          autoNumber={{ field:'no', getNext: getNextNo }}
          onSaveAndGenerate={record => generateForm({ docType:'RFI', titleAr:'طلب استيضاح', fields:FIELDS, record })}/>
      )}

      {/* Revision confirm (status C) */}
      {confirmC && (
        <div className="modal-overlay">
          <div className="modal" style={{ width:440 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color:'var(--amber)' }}>{d.revision.title}</div>
            </div>
            <div style={{ background:'var(--bg3)', border:'1px solid #9e6a0333', borderRadius:'var(--radius)', padding:16, marginBottom:20, fontSize:12 }}>
              <div style={{ color:'var(--text2)', marginBottom:12 }}>{d.revision.body}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={{ background:'#da363318', border:'1px solid #da363333', borderRadius:'var(--radius-sm)', padding:'8px 12px' }}>
                  <div style={{ color:'var(--text3)', fontSize:10, marginBottom:4 }}>يُؤرشف</div>
                  <div style={{ fontFamily:'var(--mono)', color:'var(--red)', fontWeight:700 }}>REV.{confirmC.rev}</div>
                </div>
                <div style={{ background:'#3fb95018', border:'1px solid #3fb95033', borderRadius:'var(--radius-sm)', padding:'8px 12px' }}>
                  <div style={{ color:'var(--text3)', fontSize:10, marginBottom:4 }}>يُنشأ</div>
                  <div style={{ fontFamily:'var(--mono)', color:'var(--green)', fontWeight:700 }}>REV.{(confirmC.rev??0)+1}</div>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setConfirmC(null); setEditingId(null) }}>{t.common.cancel}</button>
              <button className="btn btn-ghost" style={{ borderColor:'var(--amber)', color:'var(--amber)' }} onClick={() => doSave(confirmC.id, false)}>{d.revision.saveOnly}</button>
              <button className="btn btn-primary" onClick={() => doSave(confirmC.id, true)} disabled={saving}>
                {saving ? <span className="spinner"/> : '✓ ' + d.revision.createRevision}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Can't delete */}
      {deleteBlockRow && (
        <div className="modal-overlay">
          <div className="modal" style={{ width:460 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color:'var(--red)' }}>{d.cantDelete.title}</div>
            </div>
            <div style={{ background:'#da363318', border:'1px solid #da363344', borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:20, fontSize:13, color:'var(--text)' }}>
              {d.cantDelete.body}
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10, textTransform:'uppercase', letterSpacing:'.06em', fontWeight:600 }}>
                {d.cantDelete.revisions}
              </div>
              {deleteBlockRevs.map(r => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:6 }}>
                  <span style={{ fontFamily:'var(--mono)', fontWeight:700, color: r.ac_co==='B'||r.ac_co==='A' ? 'var(--green)' : r.ac_co==='C' ? 'var(--amber)' : 'var(--text2)' }}>REV.{r.rev}</span>
                  <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, background: r.ac_co==='B'||r.ac_co==='A' ? '#1a7f37' : r.ac_co==='C' ? '#da3633' : '#444', color:'#fff' }}>{r.ac_co}</span>
                  <span style={{ fontSize:12, color:'var(--text2)', flex:1 }}>{r.submission_date ?? '—'}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:20 }}>💡 {d.cantDelete.tip}</div>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button className="btn btn-primary" onClick={() => { setDeleteBlockRow(null); setDeleteBlockRevs([]) }}>{d.cantDelete.ok}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDel && (
        <div className="modal-overlay">
          <div className="modal" style={{ width:420 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color:'var(--red)' }}>{t.common.confirmDelete}</div>
            </div>
            <div style={{ background:'var(--bg3)', border:'1px solid #da363333', borderRadius:'var(--radius)', padding:16, marginBottom:20 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--blue)', marginBottom:4 }}>{confirmDel.rfi_no}</div>
              <div style={{ fontSize:13, marginBottom:8 }}>{confirmDel.subject}</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>REV.{confirmDel.rev} · {confirmDel.element} · {confirmDel.ac_co}</div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>{t.common.cancel}</button>
              <button style={{ background:'#da363322', color:'var(--red)', border:'1px solid #da363344', borderRadius:'var(--radius-sm)', padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
                onClick={() => deleteRow(confirmDel)} disabled={deleting}>
                {deleting ? <span className="spinner"/> : t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
