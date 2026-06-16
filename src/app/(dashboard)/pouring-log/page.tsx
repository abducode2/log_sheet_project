
'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/layout/Topbar'
import { useRole } from '@/lib/hooks/useRole'
import styles from '@/app/dashboard.module.css'

interface Row {
  id: string
  no: number
  cast_date: string | null
  description: string | null
  cpr_no: string | null
  test_7d_date: string | null
  test_7d_result: number | null
  test_28d_date: string | null
  test_28d_result: number | null
  grade: string | null
  mix_design: string | null
  supplier: string | null
  quantity_m3: number | null
  remarks: string | null
}

const GRADE_REQ: Record<string, number> = {
  '20 MPA OPC': 20, '20MPA OPC': 20,
  '35 MPA OPC': 35, '35MPA OPC': 35,
  'C20': 20, 'C25': 25, 'C30': 30, 'C35': 35, 'C40': 40,
}

function getGradeReq(grade: string | null): number {
  if (!grade) return 0
  const g = grade.trim().toUpperCase()
  for (const [k, v] of Object.entries(GRADE_REQ)) {
    if (g.includes(k.toUpperCase())) return v
  }
  const m = g.match(/(\d+)\s*MPA/)
  return m ? Number(m[1]) : 0
}

function TestResult({ val, grade }: { val: number | null; grade: string | null }) {
  if (val == null) return <span style={{ color:'var(--text3)' }}>—</span>
  const req = getGradeReq(grade)
  const ok  = !req || val >= req
  return (
    <span style={{
      fontFamily:'var(--mono)', fontWeight:600, fontSize:12,
      color: ok ? 'var(--green)' : 'var(--red)'
    }}>
      {val.toFixed(1)}
      <span style={{ fontSize:9, marginRight:3, opacity:.7 }}>{ok ? '✓' : '✗'}</span>
    </span>
  )
}

const PG = 20

export default function PouringLogPage() {
  const supabase = createClient()
  const { isAdmin, isEditor } = useRole()

  const [activeTab, setActiveTab] = useState<string>('ALL')
  const [data, setData]           = useState<Row[]>([])
  const [total, setTotal]         = useState(0)
  const [counts, setCounts]       = useState<Record<string,number>>({ ALL:0 })
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [openCol, setOpenCol]     = useState<string|null>(null)
  const [colFilters, setColFilters] = useState({
    cpr_no:'', description:'', supplier:'', grade:''
  })

  // Add modal
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState<Partial<Row>>({ 
    // concrete_type:'PC' 
  })
  const [saving, setSaving]       = useState(false)
  const [addErr, setAddErr]       = useState('')

  // Edit
  const [editId, setEditId]       = useState<string|null>(null)
  const [editForm, setEditForm]   = useState<Partial<Row>>({})
  const [editSaving, setEditSaving] = useState(false)

  // Delete
  const [confirmDel, setConfirmDel] = useState<Row|null>(null)
  const [deleting, setDeleting]     = useState(false)

  const [importing, setImporting]   = useState(false)

  const fetchCounts = useCallback(async () => {
    const { count } = await supabase.from('pouring_log').select('*', { count:'exact', head:true })
    setCounts({ ALL: count ?? 0 })
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('pouring_log').select('*', { count:'exact' })
      .order('no', { ascending: true })
      .range((page-1)*PG, page*PG-1)
    if (search) q = q.or(`description.ilike.%${search}%,cpr_no.ilike.%${search}%`)
    if (colFilters.cpr_no)       q = q.ilike('cpr_no',       `%${colFilters.cpr_no}%`)
    if (colFilters.description)  q = q.ilike('description',  `%${colFilters.description}%`)
    if (colFilters.grade)        q = q.ilike('grade',        `%${colFilters.grade}%`)
    if (colFilters.supplier)     q = q.ilike('supplier',     `%${colFilters.supplier}%`)
    const { data: rows, count } = await q
    setData((rows ?? []) as Row[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, activeTab, search, colFilters])

  useEffect(() => { fetchCounts() }, [fetchCounts])
  useEffect(() => { fetchData() },  [fetchData])

  async function getNextNo() {
    const { data } = await supabase.from('pouring_log').select('no').order('no', { ascending:false }).limit(1)
    return ((data?.[0]?.no ?? 0) as number) + 1
  }

  async function saveAdd() {
    if (!form.cast_date) { 
      setAddErr('تاريخ الصب مطلوب'); 
      return }
    setSaving(true); 
    setAddErr('')
    const no = await getNextNo()
    const { concrete_type: _, ...formData } = form as Record<string,unknown> & { concrete_type?: string }
    void _
    const { error } = await supabase.from('pouring_log').insert({ ...formData, no })
    if (error) { setAddErr(error.message); setSaving(false) }
    else { 
      setShowAdd(false); 
      setSaving(false); 
      fetchData(); 
      fetchCounts() }
  }

  async function saveEdit() {
    if (!editId) return
    setEditSaving(true)
    await supabase
    .from('pouring_log')
    .update(editForm)
    .eq('id', editId)
    setEditId(null); 
    setEditSaving(false); 
    fetchData()
  }

  async function deleteRow(row: Row) {
    setDeleting(true)
    await supabase.from('pouring_log').delete().eq('id', row.id)
    setConfirmDel(null); setDeleting(false); fetchData(); fetchCounts()
  }

  async function importFromCpr() {
    setImporting(true)
    try {
      // Fetch approved CPR rows (ac_co = 'A' or 'B')
      const { data: cprRows } = await supabase
        .from('concrete_pour_requests')
        .select('*')
        .in('ac_co', ['A', 'B'])
        .order('no', { ascending: true })

      if (!cprRows || cprRows.length === 0) {
        alert('لا توجد طلبات صب مقبولة')
        setImporting(false)
        return
      }

      // Get existing cpr_no in pouring_log to avoid duplicates
      const { data: existing } = await supabase
        .from('pouring_log')
        .select('cpr_no')
      const existingNos = new Set((existing ?? []).map((r: Record<string,unknown>) => r.cpr_no as string))

      // Filter new ones only
      const toInsert = cprRows.filter((r: Record<string,unknown>) => !existingNos.has(r.cpr_no as string))

      if (toInsert.length === 0) {
        alert('جميع الطلبات المقبولة موجودة بالفعل في سجل الصب')
        setImporting(false)
        return
      }

      // Get next no
      const { data: lastLog } = await supabase
        .from('pouring_log')
        .select('no')
        .order('no', { ascending: false })
        .limit(1)
      let nextNo = ((lastLog?.[0]?.no ?? 0) as number) + 1

      // Build insert rows
      const rows = toInsert.map((r: Record<string,unknown>) => {
        const pour = r.pour_date ? new Date(String(r.pour_date)) : null
        const fmt = (d: Date) => d.toISOString().slice(0,10)
        const test7 = pour ? fmt(new Date(pour.getTime() + 7 * 24 * 60 * 60 * 1000)) : null
        const test28 = pour ? fmt(new Date(pour.getTime() + 28 * 24 * 60 * 60 * 1000)) : null
        return {
          no:            nextNo++,
          cast_date:     r.pour_date ?? null,
          cpr_no:        r.cpr_no ?? null,
          description:   [r.description, r.location].filter(Boolean).join(' — ') || null,
          grade:         r.mix_design ?? null,
          mix_design:    r.mix_design ?? null,
          quantity_m3:   r.volume_m3 ?? null,
          supplier:      null,
          test_7d_date:  test7,
          test_28d_date: test28,
          remarks:       `مستورد من CPR · حالة: ${r.ac_co}`,
        }
      })

      const { error } = await supabase.from('pouring_log').insert(rows)
      if (error) { alert('خطأ: ' + error.message) }
      else {
        alert(`✓ تم استيراد ${rows.length} طلب صب مقبول`)
        fetchData(); fetchCounts()
      }
    } finally {
      setImporting(false)
    }
  }


  function setColFilter(col: string, val: string) {
    setColFilters(prev => ({ ...prev, [col]: val })); setOpenCol(null); setPage(1)
  }

  const pages = Math.ceil(total / PG) || 1
  const hasFilter = Object.values(colFilters).some(v => v)

  const TABS = [
    { key:'ALL', label:'الكل', color:'#8b949e', count: counts.ALL },
  ]

  const COL_HEADERS = [
    { key:'cpr_no',          label:'رقم الطلب',       w:180 },
    { key:'description',     label:'وصف العنصر',      w:undefined },
    { key:'cast_date',       label:'تاريخ الصب',      w:120 },
    { key:'mix_design',      label:'Mix Design',       w:120 },
    { key:'supplier',        label:'المورد',           w:100 },
    { key:'quantity_m3',     label:'الكمية م³',        w:80 },
    { key:'test_7d_date',    label:'تاريخ 7 أيام',    w:120 },
    { key:'test_7d_result',  label:'نتيجة 7 أيام',    w:110 },
    { key:'test_28d_date',   label:'تاريخ 28 يوم',    w:120 },
    { key:'test_28d_result', label:'نتيجة 28 يوم',    w:110 },
  ]

  return (
    <>
      <Topbar
        title="سجل الصب — Pouring Log"
        sub={`HARAJ-IQC-ALRAWAF · إجمالي ${counts.ALL} عملية صب`}
        actions={<>
        
          <button className="btn btn-ghost btn-sm" onClick={importFromCpr} disabled={importing}>
            {importing ? <><span className="spinner" style={{width:13,height:13}}/> جارٍ الاستيراد...</> : <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              استيراد من طلبات الصب (المقبولة)
            </>}
          </button>
          {/* {isEditor && (
            <button className="btn btn-primary btn-sm" onClick={() => {
              setForm({}); 
              setAddErr(''); 
              setShowAdd(true)
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              إضافة صبة
            </button>
          )} */}
        </>}
      />

      <div className="page-content" onClick={() => setOpenCol(null)}>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map(t => (
            <button key={t.key}
              className={`${styles.tab} ${activeTab===t.key ? styles.tabActive : ''}`}
              onClick={() => { setActiveTab(t.key as 'ALL'|'PC'|'RC'); setPage(1) }}
              style={activeTab===t.key ? { borderColor:t.color, color:t.color } : {}}>
              <span className={styles.tabDot} style={{ background:t.color }}/>
              {t.label}
              <span className={styles.tabCount}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-wrap">
            <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input placeholder="بحث برقم CPR أو الفيلا أو البلوك أو العنصر..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}/>
          </div>
          {hasFilter && (
            <button className="btn btn-ghost btn-sm"
              onClick={() => { setColFilters({cpr_no:'',description:'',supplier:'',grade:''}); setPage(1) }}>
              ✕ مسح الفلاتر
            </button>
          )}
        </div>

        {/* Table */}
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">
              {activeTab==='ALL' ? 'جميع عمليات الصب' : activeTab==='PC' ? 'خرسانة عادية P.C' : 'خرسانة مسلحة R.C'}
            </span>
            <span className="table-meta">{total} صبة · صفحة {page} من {pages}</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{width:40}}>#</th>
                  {/* <th style={{width:110}}>تاريخ الصب</th> */}
                  {COL_HEADERS.map(col => (
                    <th key={col.key} style={col.w ? {width:col.w} : {}} onClick={e=>e.stopPropagation()}>
                      <div style={{position:'relative'}}>
                        <button className={styles.colFilterBtn}
                          style={colFilters[col.key as keyof typeof colFilters] ? {color:'var(--blue)'} : {}}
                          onClick={() => setOpenCol(openCol===col.key ? null : col.key)}>
                          {col.label}
                          {colFilters[col.key as keyof typeof colFilters]
                            ? <span className={styles.colFilterActive}>●</span>
                            : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                          }
                        </button>
                        {openCol===col.key && (
                          <div className={styles.colDropdown} onClick={e=>e.stopPropagation()}>
                            <input className={styles.colSearchInput}
                              placeholder={`بحث في ${col.label}...`}
                              value={colFilters[col.key as keyof typeof colFilters]}
                              onChange={e => setColFilters(prev=>({...prev,[col.key]:e.target.value}))}
                              autoFocus/>
                            <div className={styles.colOptions}>
                              <div className={`${styles.colOption} ${!colFilters[col.key as keyof typeof colFilters]?styles.colOptionActive:''}`}
                                onClick={()=>setColFilter(col.key,'')}>الكل</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                  {(isEditor||isAdmin) && <th style={{width:110}}>إجراء</th>}

                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11}>
                    <div className="loading-overlay"><div className="spinner"/><span>جارٍ التحميل...</span></div>
                  </td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={11}>
                    <div className="empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="3" width="20" height="14" rx="2"/>
                        <path d="M8 21h8M12 17v4"/>
                      </svg>
                      <div className="empty-title">لا توجد بيانات صب</div>
                      <div className="empty-sub">أضف صبة جديدة أو استورد من Excel</div>
                    </div>
                  </td></tr>
                ) : data.map(row => {
                  const isEditing = editId === row.id
                  return (
                    <tr key={row.id}>
                      <td className="cell-mono cell-dim">{row.no}</td>

                      {/* <td className="cell-mono cell-muted">{row.cast_date ?? '—'}</td> */}

                      {/* cpr_no */}
                      <td>
                        <span className="cell-mono cell-blue" style={{fontSize:11}}>{row.cpr_no??'—'}</span>
                      </td>

                      {/* description */}
                      <td>
                        {isEditing
                          ? <input className="form-input" style={{padding:'4px 8px',fontSize:12}}
                              value={editForm.description??''} 
                              onChange={e=>setEditForm
                                (p=>({...p,description:e.target.value}))}/>
                          : <span className="cell-desc" title={row.description??''}>{row.description??'—'}</span>}
                      </td>

                      {/* cast_date */}
                      <td>
                        {isEditing
                          ? <input type="date" className="form-input" style={{padding:'4px 8px',fontSize:11}}
                              value={editForm.cast_date??''} onChange={e=>setEditForm(p=>({...p,cast_date:e.target.value}))}/>
                          : <span className="cell-mono cell-muted">{row.cast_date??'—'}</span>}
                      </td>
                    {/* mix_design */}
                      <td>
                        <span style={{
                          fontSize:10, padding:'2px 7px', borderRadius:4,
                          background:'var(--bg3)', border:'1px solid var(--border)',
                          fontFamily:'var(--mono)', color:'var(--purple)', whiteSpace:'nowrap'
                        }}>
                          {row.mix_design ?? row.grade ?? '—'}
                        </span>
                      </td>
                      {/* supplier */}
                      <td style={{fontSize:11,color:'var(--text2)'}}>
                        {isEditing
                          ? <input className="form-input" style={{padding:'4px 8px',fontSize:11}}
                              value={editForm.supplier??''}
                              onChange={e=>setEditForm(p=>({...p,supplier:e.target.value}))}/>
                          : <>{row.supplier??'—'}</>}
                      </td>

                      {/* quantity_m3 */}
                      <td className="cell-mono" style={{color:'var(--orange)',fontWeight:600,textAlign:'center'}}>
                        {row.quantity_m3!=null ? row.quantity_m3 : '—'}
                      </td>


                      {/* test_7d_date */}
                      <td>
                        {isEditing
                          ? <input type="date" className="form-input" style={{padding:'4px 8px',fontSize:11}}
                              value={editForm.test_7d_date??''} onChange={e=>setEditForm(p=>({...p,test_7d_date:e.target.value}))}/>
                          : <span className="cell-mono cell-muted">{row.test_7d_date??'—'}</span>}
                      </td>

                      {/* test_7d_result */}
                      <td>
                        {isEditing
                          ? <input type="number" className="form-input" style={{padding:'4px 6px',fontSize:11,width:70}}
                              value={editForm.test_7d_result??''} onChange={e=>setEditForm(p=>({...p,test_7d_result:Number(e.target.value)}))}/>
                          : <TestResult val={row.test_7d_result} grade={row.grade}/>}
                      </td>

                      {/* test_28d_date */}
                      <td>
                        {isEditing
                          ? <input type="date" className="form-input" style={{padding:'4px 8px',fontSize:11}}
                              value={editForm.test_28d_date??''} onChange={e=>setEditForm(p=>({...p,test_28d_date:e.target.value}))}/>
                          : <span className="cell-mono cell-muted">{row.test_28d_date??'—'}</span>}
                      </td>

                      {/* test_28d_result */}
                      <td>
                        {isEditing
                          ? <input type="number" className="form-input" style={{padding:'4px 6px',fontSize:11,width:70}}
                              value={editForm.test_28d_result??''} onChange={e=>setEditForm(p=>({...p,test_28d_result:Number(e.target.value)}))}/>
                          : <TestResult val={row.test_28d_result} grade={row.grade}/>}
                      </td>

                      {/* actions */}
                      {(isEditor||isAdmin) && (
                        <td>
                          {isEditing ? (
                            <div style={{display:'flex',gap:4}}>
                              <button className={styles.btnSave} onClick={saveEdit} disabled={editSaving}>
                                {editSaving?'...':'✓'}
                              </button>
                              <button className={styles.btnCancel} onClick={()=>setEditId(null)}>✕</button>
                            </div>
                          ) : (
                            <div style={{display:'flex',gap:4}}>
                              <button className={styles.btnEdit} 
                              onClick={()=>{
                                setEditId(row.id);
                                setEditForm(row)}}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                                تعديل
                              </button>
                              {isAdmin && (
                                <button className={styles.btnDel} onClick={()=>setConfirmDel(row)}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                    <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span style={{fontSize:11,color:'var(--text3)',marginLeft:'auto'}}>إجمالي {total} صبة</span>
            {Array.from({length:Math.min(pages,7)},(_,i)=>(
              <button key={i} className={`pg-btn ${page===i+1?'active':''}`} onClick={()=>setPage(i+1)}>{i+1}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="modal" style={{width:560}}>
            <div className="modal-header">
              <div className="modal-title">إضافة صبة جديدة</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowAdd(false)}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}}>
              {[
                {k:'cast_date',     l:'تاريخ الصب *',   type:'date'},
                {k:'cpr_no',        l:'رقم CPR',        type:'text'},
                {k:'description',   l:'الوصف',           type:'text', full:true},
                {k:'grade',         l:'درجة الخرسانة',  type:'text'},
                {k:'mix_design',    l:'Mix Design',      type:'select', opts:['20 MPA OPC','25 MPA OPC','30 MPA OPC','35 MPA OPC','40 MPA OPC','20 MPA SRC','35 MPA SRC','C20','C25','C30','C35','C40']},
                {k:'supplier',      l:'المورد',         type:'text'},
                {k:'quantity_m3',   l:'الكمية م³',      type:'number'},
                {k:'test_7d_date',  l:'تاريخ اختبار 7أيام', type:'date'},
                {k:'test_7d_result',l:'نتيجة 7 أيام MPa', type:'number'},
                {k:'test_28d_date', l:'تاريخ اختبار 28يوم', type:'date'},
                {k:'test_28d_result',l:'نتيجة 28 يوم MPa', type:'number'},
                {k:'remarks',       l:'ملاحظات',        type:'text', full:true},
              ].map(f => (
                <div key={f.k} className="form-group" style={f.full?{gridColumn:'1/-1'}:{}}>
                  <label className="form-label">{f.l}</label>
                  {f.type==='select'
                    ? <select className="form-select" value={String(form[f.k as keyof Row]??'')} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}>
                        {f.opts?.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    : <input type={f.type} className="form-input"
                        value={String(form[f.k as keyof Row]??'')}
                        onChange={e=>setForm(p=>({...p,[f.k]:f.type==='number'?Number(e.target.value):e.target.value}))}/>
                  }
                </div>
              ))}
            </div>
            {addErr && <div style={{fontSize:12,color:'var(--red)',background:'#da363318',border:'1px solid #da363344',borderRadius:'var(--radius-sm)',padding:'8px 12px',marginBottom:12}}>{addErr}</div>}
            <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
              <button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={saveAdd} disabled={saving}>
                {saving?<span className="spinner"/>:'حفظ الصبة'}
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
              <div className="modal-title" style={{color:'var(--red)'}}>تأكيد الحذف</div>
            </div>
            <div style={{background:'var(--bg3)',border:'1px solid #da363333',borderRadius:'var(--radius)',padding:16,marginBottom:20}}>
              <div style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',marginBottom:4}}>{confirmDel.cpr_no??'—'}</div>
              <div style={{fontSize:13}}>{confirmDel.description??'—'}</div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={()=>setConfirmDel(null)}>إلغاء</button>
              <button style={{background:'#da363322',color:'var(--red)',border:'1px solid #da363344',borderRadius:'var(--radius-sm)',padding:'7px 14px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}
                onClick={()=>deleteRow(confirmDel)} disabled={deleting}>
                {deleting?<span className="spinner"/>:'حذف نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
