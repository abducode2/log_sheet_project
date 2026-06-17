
'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/layout/Topbar'
import { useRole } from '@/lib/hooks/useRole'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import styles from '@/app/(dashboard)/dashboard.module.css'
import { uploadToCloudinary, getCloudinaryViewerUrl } from '@/lib/utils/cloudinary'

interface Row {
  id: string
  no: number
  letter_no: string
  subject: string
  date: string | null
  remarks: string | null
  pdf_url: string | null
}

interface Props {
  table: 'letters_rawaf_naga' | 'letters_naga_rawaf'
  title: string
  addTitle: string
  exportFile: string
}

const PG = 20

function LettersPage({ table, title, addTitle, exportFile }: Props) {
  const supabase = createClient()
  const { isAdmin, isEditor } = useRole()
  const { t } = useLanguage()
  const p = t.pages.letters
  const dc = t.docs

  const [data, setData]         = useState<Row[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [openCol, setOpenCol]   = useState<string|null>(null)
  const [colFilters, setColFilters] = useState({ letter_no:'', subject:'', date:'' })

  // Add modal
  const [showAdd, setShowAdd]   = useState(false)
  const [newNo,   setNewNo]     = useState('')
  const [newSub,  setNewSub]    = useState('')
  const [newDate, setNewDate]   = useState('')
  const [newRem,  setNewRem]    = useState('')
  const [saving,  setSaving]    = useState(false)
  const [addErr,  setAddErr]    = useState('')

  // Edit
  const [editId,   setEditId]   = useState<string|null>(null)
  const [editNo,   setEditNo]   = useState('')
  const [editSub,  setEditSub]  = useState('')
  const [editDate, setEditDate] = useState('')
  const [editRem,  setEditRem]  = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Delete
  const [confirmDel, setConfirmDel] = useState<Row|null>(null)
  const [deleting,   setDeleting]   = useState(false)
  const [uploadingId, setUploadingId] = useState<string|null>(null)
  const [viewingPdf, setViewingPdf]   = useState<{url:string;name:string;directUrl?:string}|null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    let q = supabase.from(table).select('*', { count:'exact' })
      .order('no', { ascending: true })
      .range((page-1)*PG, page*PG-1)
    if (search) q = q.or(`letter_no.ilike.%${search}%,subject.ilike.%${search}%`)
    if (colFilters.letter_no) q = q.ilike('letter_no', `%${colFilters.letter_no}%`)
    if (colFilters.subject)   q = q.ilike('subject',   `%${colFilters.subject}%`)
    if (colFilters.date)      q = q.ilike('date',       `%${colFilters.date}%`)
    const { data: rows, count } = await q
    setData((rows ?? []) as Row[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, search, colFilters, table])

  useEffect(() => { fetchData() }, [fetchData])

  async function getNextNo(): Promise<number> {
    const { data } = await supabase.from(table).select('no').order('no', { ascending: false }).limit(1)
    return ((data?.[0]?.no ?? 0) as number) + 1
  }

  async function openAdd() {
    setNewNo(''); setNewSub(''); setNewDate(''); setNewRem(''); setAddErr('')
    setShowAdd(true)
  }

  async function saveAdd() {
    if (!newNo || !newSub) { setAddErr(p.requiredError); return }
    setSaving(true)
    const nextNo = await getNextNo()
    const { error } = await supabase.from(table).insert({
      no: nextNo, letter_no: newNo, subject: newSub,
      date: newDate || null, remarks: newRem || null
    })
    if (error) { setAddErr(error.message); setSaving(false) }
    else { setShowAdd(false); setSaving(false); fetchData() }
  }

  function startEdit(row: Row) {
    setEditId(row.id); setEditNo(row.letter_no); setEditSub(row.subject)
    setEditDate(row.date ?? ''); setEditRem(row.remarks ?? '')
  }

  async function saveEdit() {
    if (!editId) return
    setEditSaving(true)
    await supabase.from(table).update({
      letter_no: editNo, subject: editSub,
      date: editDate || null, remarks: editRem || null
    }).eq('id', editId)
    setEditId(null); setEditSaving(false); fetchData()
  }

  async function deleteRow(row: Row) {
    setDeleting(true)
    await supabase.from(table).delete().eq('id', row.id)
    setConfirmDel(null); setDeleting(false); fetchData()
  }

  async function exportExcel() {
    const { data: all } = await supabase.from(table).select('*').order('no')
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(all ?? [])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, table)
    XLSX.writeFile(wb, exportFile)
  }

  function setColFilter(col: string, val: string) {
    setColFilters(prev => ({ ...prev, [col]: val })); setOpenCol(null); setPage(1)
  }

  const pages = Math.ceil(total / PG) || 1
  const hasFilter = Object.values(colFilters).some(v => v)

  const COL_HEADERS = [
    { key:'letter_no', label: p.cols.letterNo, w:160 },
    { key:'subject',   label: p.cols.subject,  w:undefined },
    { key:'date',      label: p.cols.date,     w:130 },
  ]

  return (
    <>
      <Topbar
        title={title}
        sub={`HARAJ-IQC-ALRAWAF · ${p.sub.replace('{n}', String(total))}`}
        actions={<>

          {isEditor && (
            <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {p.addBtn}
            </button>
          )}
        </>}
      />

      <div className="page-content" onClick={() => setOpenCol(null)}>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-wrap">
            <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input placeholder={p.searchPlaceholder} value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}/>
          </div>
          {hasFilter && (
            <button className="btn btn-ghost btn-sm"
              onClick={() => { setColFilters({ letter_no:'', subject:'', date:'' }); setPage(1) }}>
              {dc.clearFilters}
            </button>
          )}
          <span style={{ fontSize:11, color:'var(--text3)', marginRight:'auto' }}>
            {p.paginationInfo.replace('{total}',String(total)).replace('{page}',String(page)).replace('{pages}',String(pages))}
          </span>
        </div>

        {/* Table */}
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">{title}</span>
            <span className="table-meta">{total} خطاب</span>
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
                          style={colFilters[col.key as keyof typeof colFilters] ? { color:'var(--blue)' } : {}}
                          onClick={() => setOpenCol(openCol === col.key ? null : col.key)}
                        >
                          {col.label}
                          {colFilters[col.key as keyof typeof colFilters]
                            ? <span className={styles.colFilterActive}>●</span>
                            : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                          }
                        </button>
                        {openCol === col.key && (
                          <div className={styles.colDropdown} onClick={e => e.stopPropagation()}>
                            <input className={styles.colSearchInput}
                              placeholder={`بحث في ${col.label}...`}
                              value={colFilters[col.key as keyof typeof colFilters]}
                              onChange={e => setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                              autoFocus/>
                            <div className={styles.colOptions}>
                              <div className={`${styles.colOption} ${!colFilters[col.key as keyof typeof colFilters] ? styles.colOptionActive : ''}`}
                                onClick={() => setColFilter(col.key, '')}>الكل</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                  <th style={{width:110}}>{p.cols.action}</th>
                  <th style={{width:90}}>{p.cols.pdf}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5}>
                    <div className="loading-overlay"><div className="spinner"/><span>{t.common.loading}</span></div>
                  </td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={5}>
                    <div className="empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                      <div className="empty-title">{p.empty}</div>
                      <div className="empty-sub">{p.emptySub}</div>
                    </div>
                  </td></tr>
                ) : data.map(row => (
                  <tr key={row.id}>
                    <td className="cell-mono cell-dim">{row.no}</td>

                    {/* letter_no */}
                    <td>
                      {editId === row.id
                        ? <input className="form-input" style={{ padding:'4px 8px', fontSize:11 }}
                            value={editNo} onChange={e => setEditNo(e.target.value)} autoFocus/>
                        : <span className="cell-mono cell-blue">{row.letter_no}</span>
                      }
                    </td>

                    {/* subject */}
                    <td>
                      {editId === row.id
                        ? <input className="form-input" style={{ padding:'4px 8px', fontSize:12 }}
                            value={editSub} onChange={e => setEditSub(e.target.value)}/>
                        : <span className="cell-desc" title={row.subject}>{row.subject}</span>
                      }
                    </td>

                    {/* date */}
                    <td>
                      {editId === row.id
                        ? <input type="date" className="form-input" style={{ padding:'4px 8px', fontSize:11 }}
                            value={editDate} onChange={e => setEditDate(e.target.value)}/>
                        : <span className="cell-mono cell-muted">{row.date ?? '—'}</span>
                      }
                    </td>

                    {/* actions */}
                    <td>
                      {editId === row.id ? (
                        <div style={{ display:'flex', gap:4 }}>
                          <button className={styles.btnSave} onClick={saveEdit} disabled={editSaving}>
                            {editSaving ? '...' : '✓ حفظ'}
                          </button>
                          <button className={styles.btnCancel} onClick={() => setEditId(null)}>✕</button>
                        </div>
                      ) : (
                        (isEditor || isAdmin) ? (
                          <div style={{ display:'flex', gap:4 }}>
                            <button className={styles.btnEdit} onClick={() => startEdit(row)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            {t.common.edit}
                          </button>
                           <button className={styles.btnDel} onClick={() => setConfirmDel(row)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </div>
                        ) : (
                          <span style={{ color:'var(--text2)', fontSize:11 }}>—</span>
                        )
                      )}
                    </td>

                    {/* PDF Cell */}
                    <td style={{textAlign:'center', padding:'6px 8px'}}>
                      {uploadingId === row.id ? (
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                          <div className="spinner" style={{width:16,height:16}}/>
                          <span style={{fontSize:9,color:'var(--text3)'}}>{dc.pdf.uploading}</span>
                        </div>
                      ) : row.pdf_url ? (
                        <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'center'}}>
                          <button
                            onClick={() => setViewingPdf({
                              url: getCloudinaryViewerUrl(row.pdf_url!),
                              name: row.letter_no,
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
                            {t.common.view}
                          </button>
                          {(isEditor || isAdmin) && (
                            <button
                              onClick={async () => {
                                if (!confirm(dc.pdf.deleteConfirm)) return
                                await fetch('/api/cloudinary-delete', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ url: row.pdf_url }),
                                })
                                const { error } = await supabase
                                  .from(table)
                                  .update({ pdf_url: null })
                                  .eq('id', row.id)
                                if (error) { alert(dc.pdf.deleteErr + ': ' + error.message); return }
                                setData(prev => prev.map(r => r.id===row.id ? {...r, pdf_url:null} : r))
                              }}
                              style={{fontSize:9,color:'var(--red)',cursor:'pointer',textDecoration:'underline',
                                background:'transparent',border:'none',fontFamily:'inherit',padding:0}}
                            >
                              {t.common.delete}
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
                        }} title={t.common.upload}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          {t.common.upload}
                          <input type="file" accept="application/pdf" style={{display:'none'}}
                            onChange={async e => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              setUploadingId(row.id)
                              const { url, error } = await uploadToCloudinary(file, `p179/letters/${table}`)
                              if (error) { alert(dc.pdf.uploadErr + ': ' + error); setUploadingId(null); return }
                              await supabase.from(table).update({ pdf_url: url }).eq('id', row.id)
                              setData(prev => prev.map(r => r.id===row.id ? {...r, pdf_url:url} : r))
                              setUploadingId(null)
                              e.target.value = ''
                            }}/>
                        </label>
                      ) : (
                        <span style={{color:'var(--text3)',fontSize:10}}>—</span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <span style={{ fontSize:11, color:'var(--text3)', marginLeft:'auto' }}>{t.common.total}: {total}</span>
            {Array.from({ length: Math.min(pages,7) }, (_,i) => (
              <button key={i} className={`pg-btn ${page===i+1?'active':''}`} onClick={() => setPage(i+1)}>
                {i+1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PDF Viewer Modal */}
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
              {dc.pdf.closeViewer}
            </button>
          </div>
          <iframe src={viewingPdf.url} style={{flex:1,border:'none',width:'100%'}} title="PDF Viewer"/>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowAdd(false)}>
          <div className="modal" style={{ width:480 }}>
            <div className="modal-header">
              <div className="modal-title">{addTitle}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
              <div className="form-group">
                <label className="form-label">
                  {p.fields.letterNo} <span style={{color:'var(--red)'}}> *</span>
                </label>
                <input className="form-input" value={newNo} onChange={e => setNewNo(e.target.value)}
                  placeholder="M2P06-RWF-NAG-LTR-..."/>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.date}</label>
                <input type="date" className="form-input" value={newDate} onChange={e => setNewDate(e.target.value)}/>
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">{p.fields.subject} <span style={{color:'var(--red)'}}> *</span></label>
                <input className="form-input" value={newSub} onChange={e => setNewSub(e.target.value)} placeholder="..."/>
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">{p.fields.remarks}</label>
                <textarea className="form-input" rows={2} value={newRem} onChange={e => setNewRem(e.target.value)} style={{resize:'vertical'}}/>
              </div>
            </div>
            {addErr && <div style={{fontSize:12,color:'var(--red)',background:'#da363318',border:'1px solid #da363344',borderRadius:'var(--radius-sm)',padding:'8px 12px',marginBottom:12}}>{addErr}</div>}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>{t.common.cancel}</button>
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
          <div className="modal" style={{ width:400 }}>
            <div className="modal-header">
              <div className="modal-title" style={{color:'var(--red)'}}>{t.common.confirmDelete}</div>
            </div>
            <div style={{background:'var(--bg3)',border:'1px solid #da363333',borderRadius:'var(--radius)',padding:16,marginBottom:20}}>
              <div style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',marginBottom:4}}>{confirmDel.letter_no}</div>
              <div style={{fontSize:13}}>{confirmDel.subject}</div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>{t.common.cancel}</button>
              <button style={{background:'#da363322',color:'var(--red)',border:'1px solid #da363344',borderRadius:'var(--radius-sm)',padding:'7px 14px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}
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

export default LettersPage
