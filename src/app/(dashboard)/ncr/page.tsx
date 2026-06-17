'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/layout/Topbar'
import { useRole } from '@/lib/hooks/useRole'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import styles from '@/app/(dashboard)/dashboard.module.css'
import { uploadToCloudinary, getCloudinaryViewerUrl } from '@/lib/utils/cloudinary'

interface Row {
  id: string
  no: number
  ncr_no: string
  description: string
  issue_date: string | null
  close_date: string | null
  status: string | null
  location: string | null
  remarks: string | null
  pdf_url: string | null
}

const STATUS_OPTS = ['Open', 'Closed']
const STATUS_BG: Record<string,{bg:string;color:string}> = {
  Open:   { bg:'#da3633', color:'#fff' },
  Closed: { bg:'#1a7f37', color:'#fff' },
}

const PG = 20

export default function NcrPage() {
  const supabase = createClient()
  const { isAdmin, isEditor } = useRole()
  const { t } = useLanguage()
  const p = t.pages.ncr

  const STATUS_LABELS = useMemo(() => ({
    Open:   t.status.open,
    Closed: t.status.closed,
  }), [t])

  const COL_HEADERS = useMemo(() => [
    { key:'ncr_no',      label: p.ncrNoCol,    w: 160 },
    { key:'description', label: p.descCol,     w: undefined },
    { key:'issue_date',  label: p.issueDate,   w: 130 },
    { key:'close_date',  label: p.closeDate,   w: 130 },
    { key:'status',      label: p.fields.status, w: 110 },
  ], [p])

  const [data, setData]         = useState<Row[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [filterSt, setFilterSt] = useState('')
  const [loading, setLoading]   = useState(true)
  const [openCol, setOpenCol]   = useState<string|null>(null)
  const [colFilters, setColFilters] = useState({ ncr_no:'', description:'', issue_date:'', status:'' })

  const [showAdd, setShowAdd]   = useState(false)
  const [newNo,   setNewNo]     = useState('')
  const [newDesc, setNewDesc]   = useState('')
  const [newIssue,setNewIssue]  = useState('')
  const [newClose,setNewClose]  = useState('')
  const [newSt,   setNewSt]     = useState('Open')
  const [newLoc,  setNewLoc]    = useState('')
  const [newRem,  setNewRem]    = useState('')
  const [saving,  setSaving]    = useState(false)
  const [addErr,  setAddErr]    = useState('')

  const [editId,    setEditId]    = useState<string|null>(null)
  const [editNo,    setEditNo]    = useState('')
  const [editDesc,  setEditDesc]  = useState('')
  const [editIssue, setEditIssue] = useState('')
  const [editClose, setEditClose] = useState('')
  const [editSt,    setEditSt]    = useState('')
  const [editSaving,setEditSaving]= useState(false)

  const [confirmDel, setConfirmDel] = useState<Row|null>(null)
  const [deleting,   setDeleting]   = useState(false)
  const [uploadingId, setUploadingId] = useState<string|null>(null)
  const [viewingPdf, setViewingPdf]   = useState<{url:string;name:string;directUrl?:string}|null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('non_conformance_reports')
      .select('*', { count:'exact' })
      .order('no', { ascending: true })
      .range((page-1)*PG, page*PG-1)
    if (search)   q = q.or(`ncr_no.ilike.%${search}%,description.ilike.%${search}%`)
    if (filterSt) q = q.eq('status', filterSt)
    if (colFilters.ncr_no)      q = q.ilike('ncr_no',      `%${colFilters.ncr_no}%`)
    if (colFilters.description) q = q.ilike('description',  `%${colFilters.description}%`)
    if (colFilters.issue_date)  q = q.ilike('issue_date',   `%${colFilters.issue_date}%`)
    const { data: rows, count } = await q
    setData((rows ?? []) as Row[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, search, filterSt, colFilters])

  useEffect(() => { fetchData() }, [fetchData])

  async function getNextNo(): Promise<number> {
    const { data } = await supabase.from('non_conformance_reports')
      .select('no').order('no', { ascending: false }).limit(1)
    return ((data?.[0]?.no ?? 0) as number) + 1
  }

  async function saveAdd() {
    if (!newNo || !newDesc) { setAddErr(p.requiredError); return }
    setSaving(true)
    const nextNo = await getNextNo()
    const { error } = await supabase.from('non_conformance_reports').insert({
      no: nextNo, ncr_no: newNo, description: newDesc,
      issue_date: newIssue || null, close_date: newClose || null,
      status: newSt, location: newLoc || null, remarks: newRem || null
    })
    if (error) { setAddErr(error.message); setSaving(false) }
    else { setShowAdd(false); setSaving(false); fetchData() }
  }

  function startEdit(row: Row) {
    setEditId(row.id); setEditNo(row.ncr_no); setEditDesc(row.description)
    setEditIssue(row.issue_date ?? ''); setEditClose(row.close_date ?? '')
    setEditSt(row.status ?? 'Open')
  }

  async function saveEdit() {
    if (!editId) return
    setEditSaving(true)
    await supabase.from('non_conformance_reports').update({
      ncr_no: editNo, description: editDesc,
      issue_date: editIssue || null, close_date: editClose || null,
      status: editSt
    }).eq('id', editId)
    setEditId(null); setEditSaving(false); fetchData()
  }

  async function deleteRow(row: Row) {
    setDeleting(true)
    await supabase.from('non_conformance_reports').delete().eq('id', row.id)
    setConfirmDel(null); setDeleting(false); fetchData()
  }

  function setColFilter(col: string, val: string) {
    setColFilters(prev => ({ ...prev, [col]: val })); setOpenCol(null); setPage(1)
  }

  const pages = Math.ceil(total / PG) || 1
  const hasFilter = Object.values(colFilters).some(v=>v) || !!filterSt

  return (
    <>
      <Topbar
        title={p.title}
        sub={p.sub.replace('{n}', String(total))}
        actions={<>
          {isEditor && (
            <button className="btn btn-primary btn-sm" onClick={() => {
              setNewNo(''); setNewDesc(''); setNewIssue(''); setNewClose('')
              setNewSt('Open'); setNewLoc(''); setNewRem(''); setAddErr(''); setShowAdd(true)
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {p.addBtn}
            </button>
          )}
        </>}
      />

      <div className="page-content" onClick={() => setOpenCol(null)}>
        <div className="toolbar">
          <div className="search-wrap">
            <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input placeholder={t.docs.searchAll} value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}/>
          </div>
          {['', 'Open', 'Closed'].map(s => (
            <button key={s}
              className={`filter-chip ${filterSt===s ? 'active' : ''}`}
              onClick={() => { setFilterSt(s); setPage(1) }}>
              {s === '' ? `${t.common.all} (${total})` : STATUS_LABELS[s as 'Open'|'Closed']}
            </button>
          ))}
          {hasFilter && (
            <button className="btn btn-ghost btn-sm"
              onClick={() => { setColFilters({ncr_no:'',description:'',issue_date:'',status:''}); setFilterSt(''); setPage(1) }}>
              {t.docs.clearFilters}
            </button>
          )}
        </div>

        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">{p.title}</span>
            <span className="table-meta">{total} {p.unit} · {t.common.page} {page} {t.common.of} {pages}</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{width:40}}>#</th>
                  {COL_HEADERS.map(col => (
                    <th key={col.key} style={col.w ? {width:col.w} : {}} onClick={e => e.stopPropagation()}>
                      <div style={{ position:'relative' }}>
                        <button className={styles.colFilterBtn}
                          style={colFilters[col.key as keyof typeof colFilters] ? {color:'var(--blue)'} : {}}
                          onClick={() => setOpenCol(openCol===col.key ? null : col.key)}>
                          {col.label}
                          {colFilters[col.key as keyof typeof colFilters]
                            ? <span className={styles.colFilterActive}>●</span>
                            : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                          }
                        </button>
                        {openCol === col.key && (
                          <div className={styles.colDropdown} onClick={e => e.stopPropagation()}>
                            <input className={styles.colSearchInput}
                              placeholder={`${col.label}...`}
                              value={colFilters[col.key as keyof typeof colFilters]}
                              onChange={e => setColFilters(prev => ({...prev,[col.key]:e.target.value}))}
                              autoFocus/>
                            <div className={styles.colOptions}>
                              <div className={`${styles.colOption} ${!colFilters[col.key as keyof typeof colFilters]?styles.colOptionActive:''}`}
                                onClick={() => setColFilter(col.key,'')}>{t.common.all}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                  <th style={{width:110}}>{t.docs.cols.action}</th>
                  <th style={{width:90}}>{t.docs.cols.pdf}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7}>
                    <div className="loading-overlay"><div className="spinner"/><span>{t.common.loading}</span></div>
                  </td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      <div className="empty-title">{p.empty}</div>
                      <div className="empty-sub">{p.emptySub}</div>
                    </div>
                  </td></tr>
                ) : data.map(row => {
                  const isEditing = editId === row.id
                  const stStyle = STATUS_BG[row.status ?? ''] ?? {bg:'#444',color:'#ccc'}
                  return (
                    <tr key={row.id}>
                      <td className="cell-mono cell-dim">{row.no}</td>

                      <td>{isEditing
                        ? <input className="form-input" style={{padding:'4px 8px',fontSize:11}} value={editNo} onChange={e=>setEditNo(e.target.value)} autoFocus/>
                        : <span className="cell-mono cell-blue">{row.ncr_no}</span>}
                      </td>

                      <td>{isEditing
                        ? <input className="form-input" style={{padding:'4px 8px',fontSize:12}} value={editDesc} onChange={e=>setEditDesc(e.target.value)}/>
                        : <span className="cell-desc" title={row.description}>{row.description}</span>}
                      </td>

                      <td>{isEditing
                        ? <input type="date" className="form-input" style={{padding:'4px 8px',fontSize:11}} value={editIssue} onChange={e=>setEditIssue(e.target.value)}/>
                        : <span className="cell-mono cell-muted">{row.issue_date ?? '—'}</span>}
                      </td>

                      <td>{isEditing
                        ? <input type="date" className="form-input" style={{padding:'4px 8px',fontSize:11}} value={editClose} onChange={e=>setEditClose(e.target.value)}/>
                        : <span className="cell-mono cell-muted">{row.close_date ?? '—'}</span>}
                      </td>

                      <td style={{padding:'6px 14px'}}>
                        {isEditing ? (
                          <select className="form-select" style={{padding:'4px 8px',fontSize:11}}
                            value={editSt} onChange={e=>setEditSt(e.target.value)}>
                            {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABELS[s as 'Open'|'Closed']}</option>)}
                          </select>
                        ) : (
                          <span style={{
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            padding:'4px 12px', borderRadius:4,
                            background:stStyle.bg, color:stStyle.color,
                            fontSize:12, fontWeight:700, fontFamily:'var(--mono)'
                          }}>
                            {STATUS_LABELS[row.status as 'Open'|'Closed'] ?? row.status}
                          </span>
                        )}
                      </td>

                      <td>
                        {isEditing ? (
                          <div style={{display:'flex',gap:4}}>
                            <button className={styles.btnSave} onClick={saveEdit} disabled={editSaving}>
                              {editSaving ? '...' : '✓'}
                            </button>
                            <button className={styles.btnCancel} onClick={()=>setEditId(null)}>✕</button>
                          </div>
                        ) : (isEditor || isAdmin) ? (
                          <div style={{display:'flex',gap:4}}>
                            <button className={styles.btnEdit} onClick={()=>startEdit(row)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              {t.common.edit}
                            </button>
                            <button className={styles.btnDel} onClick={()=>setConfirmDel(row)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                              </svg>
                            </button>
                          </div>
                        ) : null}
                      </td>

                      {/* PDF Cell */}
                      <td style={{textAlign:'center', padding:'6px 8px'}}>
                        {uploadingId === row.id ? (
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                            <div className="spinner" style={{width:16,height:16}}/>
                            <span style={{fontSize:9,color:'var(--text3)'}}>{t.docs.pdf.uploading}</span>
                          </div>
                        ) : row.pdf_url ? (
                          <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'center'}}>
                            <button
                              onClick={() => setViewingPdf({ url: getCloudinaryViewerUrl(row.pdf_url!), name: row.ncr_no ?? String(row.no), directUrl: row.pdf_url! })}
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
                                if (!confirm(t.docs.pdf.deleteConfirm)) return
                                await fetch('/api/cloudinary-delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: row.pdf_url }) })
                                const { error } = await supabase.from('non_conformance_reports').update({ pdf_url: null }).eq('id', row.id)
                                if (error) { alert(t.docs.pdf.deleteErr + error.message); return }
                                setData(prev => prev.map(r => r.id===row.id ? {...r, pdf_url:null} : r))
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
                                const { url, error } = await uploadToCloudinary(file, 'p179/ncr')
                                if (error) { alert(t.docs.pdf.uploadErr + error); setUploadingId(null); return }
                                await supabase.from('non_conformance_reports').update({ pdf_url: url }).eq('id', row.id)
                                setData(prev => prev.map(r => r.id===row.id ? {...r, pdf_url:url} : r))
                                setUploadingId(null); e.target.value = ''
                              }}/>
                          </label>
                        ) : (
                          <span style={{color:'var(--text3)',fontSize:10}}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span style={{fontSize:11,color:'var(--text3)',marginLeft:'auto'}}>{t.common.total} {total} {p.unit}</span>
            {Array.from({length:Math.min(pages,7)},(_,i)=>(
              <button key={i} className={`pg-btn ${page===i+1?'active':''}`} onClick={()=>setPage(i+1)}>{i+1}</button>
            ))}
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      {viewingPdf && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',zIndex:200,display:'flex',flexDirection:'column'}}>
          <div style={{height:48,background:'var(--bg2)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12,padding:'0 16px',flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span style={{fontSize:13,fontWeight:600,color:'var(--text)',flex:1}}>{viewingPdf.name}</span>
            <a href={viewingPdf.directUrl??viewingPdf.url} target="_blank" rel="noopener noreferrer"
              style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:6,background:'var(--accent)',color:'#fff',fontSize:12,textDecoration:'none'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {t.common.download}
            </a>
            <button onClick={() => setViewingPdf(null)}
              style={{background:'transparent',border:'1px solid var(--border)',borderRadius:6,padding:'6px 12px',color:'var(--text2)',cursor:'pointer',fontSize:12}}>
              {t.docs.pdf.closeViewer}
            </button>
          </div>
          <iframe src={viewingPdf.url} style={{flex:1,border:'none',width:'100%'}} title={t.docs.pdf.viewerTitle}/>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="modal" style={{width:520}}>
            <div className="modal-header">
              <div className="modal-title">{p.addTitle}</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowAdd(false)}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}}>
              <div className="form-group">
                <label className="form-label">{p.fields.ncrNo} <span style={{color:'var(--red)'}}>*</span></label>
                <input className="form-input" value={newNo} onChange={e=>setNewNo(e.target.value)} placeholder="NCR-001"/>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.status}</label>
                <select className="form-select" value={newSt} onChange={e=>setNewSt(e.target.value)}>
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABELS[s as 'Open'|'Closed']}</option>)}
                </select>
              </div>
              <div className="form-group" style={{gridColumn:'1/-1'}}>
                <label className="form-label">{p.fields.description} <span style={{color:'var(--red)'}}>*</span></label>
                <input className="form-input" value={newDesc} onChange={e=>setNewDesc(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.issueDate}</label>
                <input type="date" className="form-input" value={newIssue} onChange={e=>setNewIssue(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.closeDate}</label>
                <input type="date" className="form-input" value={newClose} onChange={e=>setNewClose(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.location}</label>
                <input className="form-input" value={newLoc} onChange={e=>setNewLoc(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.remarks}</label>
                <input className="form-input" value={newRem} onChange={e=>setNewRem(e.target.value)}/>
              </div>
            </div>
            {addErr && <div style={{fontSize:12,color:'var(--red)',background:'#da363318',border:'1px solid #da363344',borderRadius:'var(--radius-sm)',padding:'8px 12px',marginBottom:12}}>{addErr}</div>}
            <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
              <button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>{t.common.cancel}</button>
              <button className="btn btn-primary" onClick={saveAdd} disabled={saving}>
                {saving ? <span className="spinner"/> : t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="modal-overlay">
          <div className="modal" style={{width:400}}>
            <div className="modal-header">
              <div className="modal-title" style={{color:'var(--red)'}}>{t.common.confirmDelete}</div>
            </div>
            <div style={{background:'var(--bg3)',border:'1px solid #da363333',borderRadius:'var(--radius)',padding:16,marginBottom:20}}>
              <div style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',marginBottom:4}}>{confirmDel.ncr_no}</div>
              <div style={{fontSize:13}}>{confirmDel.description}</div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={()=>setConfirmDel(null)}>{t.common.cancel}</button>
              <button style={{background:'#da363322',color:'var(--red)',border:'1px solid #da363344',borderRadius:'var(--radius-sm)',padding:'7px 14px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}
                onClick={()=>deleteRow(confirmDel)} disabled={deleting}>
                {deleting ? <span className="spinner"/> : t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
