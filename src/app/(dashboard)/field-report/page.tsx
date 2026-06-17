'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/layout/Topbar'
import { useRole } from '@/lib/hooks/useRole'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import styles from '@/app/(dashboard)/dashboard.module.css'

interface Row {
  id: string
  no: number
  report_no: string
  subject: string
  date: string | null
  close_date: string | null
  location: string | null
  category: string | null
  priority: string | null
  inspector: string | null
  assigned_to: string | null
  observations: string | null
  action_required: string | null
  status: string | null
  remarks: string | null
}

const STATUS_OPTS   = ['Open', 'Closed']
const CATEGORY_OPTS = ['Safety', 'Quality', 'Progress', 'Environment']
const PRIORITY_OPTS = ['High', 'Medium', 'Low']

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Open:   { bg: '#da3633', color: '#fff' },
  Closed: { bg: '#1a7f37', color: '#fff' },
}
const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  High:   { bg: '#da3633', color: '#fff' },
  Medium: { bg: '#9e6a03', color: '#fff' },
  Low:    { bg: '#1a7f37', color: '#fff' },
}
const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  Safety:      { bg: '#6e40c9', color: '#fff' },
  Quality:     { bg: '#1f6feb', color: '#fff' },
  Progress:    { bg: '#9e6a03', color: '#fff' },
  Environment: { bg: '#1a7f37', color: '#fff' },
}

const PG = 20
const EMPTY_FORM = {
  report_no: '', subject: '', date: '', close_date: '',
  location: '', category: 'Quality', priority: 'Medium',
  inspector: '', assigned_to: '', status: 'Open',
  observations: '', action_required: '', remarks: '',
}

export default function FieldReportPage() {
  const supabase = createClient()
  const { isAdmin, isEditor } = useRole()
  const { t } = useLanguage()
  const p = t.pages.fieldReport

  const CATEGORY_LABELS = useMemo<Record<string,string>>(() => ({
    Safety: t.category.safety, Quality: t.category.quality,
    Progress: t.category.progress, Environment: t.category.environment,
  }), [t])

  const PRIORITY_LABELS = useMemo<Record<string,string>>(() => ({
    High: t.priority.high, Medium: t.priority.medium, Low: t.priority.low,
  }), [t])

  const STATUS_LABELS = useMemo(() => ({
    Open: t.status.open, Closed: t.status.closed,
  }), [t])

  const [data, setData]         = useState<Row[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [filterSt, setFilterSt]   = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterPri, setFilterPri] = useState('')
  const [loading, setLoading]   = useState(true)
  const [stats, setStats] = useState({ total: 0, open: 0, closed: 0, highPriority: 0 })

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ ...EMPTY_FORM })
  const [saving, setSaving]   = useState(false)
  const [addErr, setAddErr]   = useState('')

  const [editId, setEditId]         = useState<string | null>(null)
  const [editForm, setEditForm]     = useState<Partial<Row>>({})
  const [editSaving, setEditSaving] = useState(false)

  const [confirmDel, setConfirmDel] = useState<Row | null>(null)
  const [deleting, setDeleting]     = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('field_reports').select('*', { count: 'exact' })
      .order('no', { ascending: true })
      .range((page - 1) * PG, page * PG - 1)
    if (search)    q = q.or(`report_no.ilike.%${search}%,subject.ilike.%${search}%,inspector.ilike.%${search}%`)
    if (filterSt)  q = q.eq('status', filterSt)
    if (filterCat) q = q.eq('category', filterCat)
    if (filterPri) q = q.eq('priority', filterPri)
    const { data: rows, count } = await q
    setData((rows ?? []) as Row[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, search, filterSt, filterCat, filterPri])

  const fetchStats = useCallback(async () => {
    const [allR, openR, closedR, highR] = await Promise.all([
      supabase.from('field_reports').select('id', { count: 'exact', head: true }),
      supabase.from('field_reports').select('id', { count: 'exact', head: true }).eq('status', 'Open'),
      supabase.from('field_reports').select('id', { count: 'exact', head: true }).eq('status', 'Closed'),
      supabase.from('field_reports').select('id', { count: 'exact', head: true }).eq('priority', 'High'),
    ])
    setStats({
      total:        allR.count    ?? 0,
      open:         openR.count   ?? 0,
      closed:       closedR.count ?? 0,
      highPriority: highR.count   ?? 0,
    })
  }, [])

  useEffect(() => { fetchData()  }, [fetchData])
  useEffect(() => { fetchStats() }, [fetchStats])

  async function getNextNo() {
    const { data: last } = await supabase.from('field_reports').select('no').order('no', { ascending: false }).limit(1)
    return ((last?.[0]?.no ?? 0) as number) + 1
  }

  async function saveAdd() {
    if (!form.report_no || !form.subject) { setAddErr(p.requiredError); return }
    setSaving(true)
    const no = await getNextNo()
    const { error } = await supabase.from('field_reports').insert({
      no,
      report_no: form.report_no, subject: form.subject,
      date: form.date || null, close_date: form.close_date || null,
      location: form.location || null, category: form.category || null,
      priority: form.priority || null, inspector: form.inspector || null,
      assigned_to: form.assigned_to || null, status: form.status,
      observations: form.observations || null, action_required: form.action_required || null,
      remarks: form.remarks || null,
    })
    setSaving(false)
    if (error) { setAddErr(error.message); return }
    setShowAdd(false); fetchData(); fetchStats()
  }

  function startEdit(row: Row) {
    setEditId(row.id)
    setEditForm({
      report_no: row.report_no, subject: row.subject,
      date: row.date ?? '', close_date: row.close_date ?? '',
      location: row.location ?? '', category: row.category ?? 'Quality',
      priority: row.priority ?? 'Medium', inspector: row.inspector ?? '',
      assigned_to: row.assigned_to ?? '', status: row.status ?? 'Open',
      observations: row.observations ?? '', action_required: row.action_required ?? '',
      remarks: row.remarks ?? '',
    })
  }

  async function saveEdit() {
    if (!editId) return
    setEditSaving(true)
    await supabase.from('field_reports').update({
      report_no: editForm.report_no, subject: editForm.subject,
      date: editForm.date || null, close_date: editForm.close_date || null,
      location: editForm.location || null, category: editForm.category || null,
      priority: editForm.priority || null, inspector: editForm.inspector || null,
      assigned_to: editForm.assigned_to || null, status: editForm.status,
      observations: editForm.observations || null, action_required: editForm.action_required || null,
      remarks: editForm.remarks || null,
    }).eq('id', editId)
    setEditId(null); setEditSaving(false); fetchData(); fetchStats()
  }

  async function deleteRow(row: Row) {
    setDeleting(true)
    await supabase.from('field_reports').delete().eq('id', row.id)
    setConfirmDel(null); setDeleting(false); fetchData(); fetchStats()
  }

  async function exportExcel() {
    const { data: all } = await supabase.from('field_reports').select('*').order('no')
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(all ?? [])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Field Report')
    XLSX.writeFile(wb, 'field_reports_P216.xlsx')
  }

  const pages = Math.ceil(total / PG) || 1
  const hasFilter = !!filterSt || !!filterCat || !!filterPri

  function ef(key: keyof Row) { return String(editForm[key] ?? '') }
  function setEf(key: keyof Row, val: string) { setEditForm(prev => ({ ...prev, [key]: val })) }

  return (
    <>
      <Topbar
        title={p.title}
        sub={p.sub.replace('{n}', String(stats.total))}
        actions={<>
          <button className="btn btn-ghost btn-sm" onClick={exportExcel}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {t.common.export}
          </button>
          {isEditor && (
            <button className="btn btn-primary btn-sm" onClick={() => { setForm({ ...EMPTY_FORM }); setAddErr(''); setShowAdd(true) }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {p.addBtn}
            </button>
          )}
        </>}
      />

      <div className="page-content anim">

        {/* Stats Bar */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card" style={{ cursor: 'pointer' }}
            onClick={() => { setFilterSt(''); setFilterPri(''); setPage(1) }}>
            <div className="stat-num" style={{ color: 'var(--blue)' }}>{stats.total}</div>
            <div className="stat-label">{p.statTotal}</div>
            <div className="stat-bar">
              <div className="stat-fill" style={{ width: '100%', background: 'var(--blue)' }}/>
            </div>
          </div>
          <div className="stat-card" style={{ cursor: 'pointer' }}
            onClick={() => { setFilterSt('Open'); setFilterCat(''); setFilterPri(''); setPage(1) }}>
            <div className="stat-num" style={{ color: 'var(--red)' }}>{stats.open}</div>
            <div className="stat-label">{p.statOpen}</div>
            <div className="stat-bar">
              <div className="stat-fill" style={{ width: `${stats.total ? Math.round(stats.open / stats.total * 100) : 0}%`, background: 'var(--red)' }}/>
            </div>
          </div>
          <div className="stat-card" style={{ cursor: 'pointer' }}
            onClick={() => { setFilterSt('Closed'); setFilterCat(''); setFilterPri(''); setPage(1) }}>
            <div className="stat-num" style={{ color: 'var(--green)' }}>{stats.closed}</div>
            <div className="stat-label">{p.statClosed}</div>
            <div className="stat-bar">
              <div className="stat-fill" style={{ width: `${stats.total ? Math.round(stats.closed / stats.total * 100) : 0}%`, background: 'var(--green)' }}/>
            </div>
          </div>
          <div className="stat-card" style={{ cursor: 'pointer' }}
            onClick={() => { setFilterSt(''); setFilterCat(''); setFilterPri('High'); setPage(1) }}>
            <div className="stat-num" style={{ color: 'var(--amber,#d29922)' }}>{stats.highPriority}</div>
            <div className="stat-label">{p.statHighPriority}</div>
            <div className="stat-bar">
              <div className="stat-fill" style={{ width: `${stats.total ? Math.round(stats.highPriority / stats.total * 100) : 0}%`, background: 'var(--amber,#d29922)' }}/>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-wrap">
            <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input placeholder={t.docs.searchAll}
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}/>
          </div>

          {STATUS_OPTS.map(s => (
            <button key={s}
              className={`filter-chip ${filterSt === s && !filterCat && !filterPri ? 'active' : ''}`}
              onClick={() => { setFilterSt(filterSt === s ? '' : s); setPage(1) }}>
              {STATUS_LABELS[s as 'Open'|'Closed']}
            </button>
          ))}

          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }}/>

          <select className="form-select"
            style={{ height: 30, padding: '0 8px', fontSize: 11, minWidth: 110 }}
            value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1) }}>
            <option value="">{p.filterCategory}</option>
            {CATEGORY_OPTS.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>

          <select className="form-select"
            style={{ height: 30, padding: '0 8px', fontSize: 11, minWidth: 110 }}
            value={filterPri} onChange={e => { setFilterPri(e.target.value); setPage(1) }}>
            <option value="">{p.filterPriority}</option>
            {PRIORITY_OPTS.map(o => <option key={o} value={o}>{PRIORITY_LABELS[o]}</option>)}
          </select>

          {hasFilter && (
            <button className="btn btn-ghost btn-sm"
              onClick={() => { setFilterSt(''); setFilterCat(''); setFilterPri(''); setPage(1) }}>
              {t.docs.clearFilters}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">{p.title}</span>
            <span className="table-meta">{total} {p.unit} · {t.common.page} {page} {t.common.of} {pages}</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th style={{ width: 120 }}>{p.cols.reportNo}</th>
                  <th>{p.cols.subject}</th>
                  <th style={{ width: 110 }}>{p.cols.location}</th>
                  <th style={{ width: 90 }}>{p.cols.category}</th>
                  <th style={{ width: 85 }}>{p.cols.priority}</th>
                  <th style={{ width: 120 }}>{p.cols.inspector}</th>
                  <th style={{ width: 120 }}>{p.cols.assignedTo}</th>
                  <th style={{ width: 105 }}>{p.cols.date}</th>
                  <th style={{ width: 105 }}>{p.cols.closeDate}</th>
                  <th style={{ width: 90 }}>{p.cols.status}</th>
                  {(isEditor || isAdmin) && <th style={{ width: 110 }}>{t.docs.cols.action}</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12}>
                    <div className="loading-overlay"><div className="spinner"/><span>{t.common.loading}</span></div>
                  </td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={12}>
                    <div className="empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                      <div className="empty-title">{p.empty}</div>
                      <div className="empty-sub">{p.emptySub}</div>
                    </div>
                  </td></tr>
                ) : data.map(row => {
                  const isEditing = editId === row.id
                  const stStyle  = STATUS_STYLE[row.status   ?? ''] ?? { bg: '#444', color: '#ccc' }
                  const prStyle  = PRIORITY_STYLE[row.priority ?? ''] ?? { bg: '#555', color: '#ccc' }
                  const catStyle = CATEGORY_STYLE[row.category ?? ''] ?? { bg: '#333', color: '#ccc' }
                  return (
                    <tr key={row.id}>
                      <td className="cell-mono cell-dim">{row.no}</td>

                      <td>
                        {isEditing
                          ? <input className="form-input" style={{ padding: '4px 8px', fontSize: 11 }}
                              value={ef('report_no')} onChange={e => setEf('report_no', e.target.value)} autoFocus/>
                          : <span className="cell-mono cell-blue">{row.report_no}</span>}
                      </td>

                      <td>
                        {isEditing
                          ? <input className="form-input" style={{ padding: '4px 8px', fontSize: 12 }}
                              value={ef('subject')} onChange={e => setEf('subject', e.target.value)}/>
                          : <span className="cell-desc" title={row.subject ?? ''}>{row.subject}</span>}
                      </td>

                      <td>
                        {isEditing
                          ? <input className="form-input" style={{ padding: '4px 8px', fontSize: 11 }}
                              value={ef('location')} onChange={e => setEf('location', e.target.value)}/>
                          : <span style={{ fontSize: 11, color: 'var(--text2)' }}>{row.location ?? '—'}</span>}
                      </td>

                      <td style={{ padding: '6px 10px' }}>
                        {isEditing
                          ? <select className="form-select" style={{ padding: '4px 6px', fontSize: 11 }}
                              value={ef('category')} onChange={e => setEf('category', e.target.value)}>
                              {CATEGORY_OPTS.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                            </select>
                          : row.category
                            ? <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: catStyle.bg, color: catStyle.color }}>
                                {CATEGORY_LABELS[row.category] ?? row.category}
                              </span>
                            : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>

                      <td style={{ padding: '6px 10px' }}>
                        {isEditing
                          ? <select className="form-select" style={{ padding: '4px 6px', fontSize: 11 }}
                              value={ef('priority')} onChange={e => setEf('priority', e.target.value)}>
                              {PRIORITY_OPTS.map(o => <option key={o} value={o}>{PRIORITY_LABELS[o]}</option>)}
                            </select>
                          : row.priority
                            ? <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: prStyle.bg, color: prStyle.color }}>
                                {PRIORITY_LABELS[row.priority] ?? row.priority}
                              </span>
                            : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>

                      <td>
                        {isEditing
                          ? <input className="form-input" style={{ padding: '4px 8px', fontSize: 11 }}
                              value={ef('inspector')} onChange={e => setEf('inspector', e.target.value)}/>
                          : <span style={{ fontSize: 12 }}>{row.inspector ?? '—'}</span>}
                      </td>

                      <td>
                        {isEditing
                          ? <input className="form-input" style={{ padding: '4px 8px', fontSize: 11 }}
                              value={ef('assigned_to')} onChange={e => setEf('assigned_to', e.target.value)}/>
                          : <span style={{ fontSize: 12 }}>{row.assigned_to ?? '—'}</span>}
                      </td>

                      <td>
                        {isEditing
                          ? <input type="date" className="form-input" style={{ padding: '4px 8px', fontSize: 11 }}
                              value={ef('date')} onChange={e => setEf('date', e.target.value)}/>
                          : <span className="cell-mono cell-muted">{row.date ?? '—'}</span>}
                      </td>

                      <td>
                        {isEditing
                          ? <input type="date" className="form-input" style={{ padding: '4px 8px', fontSize: 11 }}
                              value={ef('close_date')} onChange={e => setEf('close_date', e.target.value)}/>
                          : <span className="cell-mono cell-muted">{row.close_date ?? '—'}</span>}
                      </td>

                      <td style={{ padding: '6px 14px' }}>
                        {isEditing
                          ? <select className="form-select" style={{ padding: '4px 8px', fontSize: 11 }}
                              value={ef('status')} onChange={e => setEf('status', e.target.value)}>
                              {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABELS[s as 'Open'|'Closed']}</option>)}
                            </select>
                          : <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              padding: '4px 12px', borderRadius: 4,
                              background: stStyle.bg, color: stStyle.color,
                              fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)',
                            }}>
                              {STATUS_LABELS[row.status as 'Open'|'Closed'] ?? row.status}
                            </span>}
                      </td>

                      {(isEditor || isAdmin) && (
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className={styles.btnSave} onClick={saveEdit} disabled={editSaving}>
                                {editSaving ? '...' : '✓'}
                              </button>
                              <button className={styles.btnCancel} onClick={() => setEditId(null)}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className={styles.btnEdit} onClick={() => startEdit(row)}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                                {t.common.edit}
                              </button>
                              {isAdmin && (
                                <button className={styles.btnDel} onClick={() => setConfirmDel(row)}>
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
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
              {t.common.total} {total} {p.unit}
            </span>
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => (
              <button key={i} className={`pg-btn ${page === i + 1 ? 'active' : ''}`}
                onClick={() => setPage(i + 1)}>{i + 1}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal" style={{ width: 580 }}>
            <div className="modal-header">
              <div className="modal-title">{p.addTitle}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div className="form-group">
                <label className="form-label">{p.fields.reportNo} <span style={{ color: 'var(--red)' }}>*</span></label>
                <input className="form-input" placeholder="FR-001"
                  value={form.report_no} onChange={e => setForm(prev => ({ ...prev, report_no: e.target.value }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.status}</label>
                <select className="form-select" value={form.status}
                  onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}>
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABELS[s as 'Open'|'Closed']}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">{p.fields.subject} <span style={{ color: 'var(--red)' }}>*</span></label>
                <input className="form-input"
                  value={form.subject} onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.category}</label>
                <select className="form-select" value={form.category}
                  onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}>
                  {CATEGORY_OPTS.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.priority}</label>
                <select className="form-select" value={form.priority}
                  onChange={e => setForm(prev => ({ ...prev, priority: e.target.value }))}>
                  {PRIORITY_OPTS.map(o => <option key={o} value={o}>{PRIORITY_LABELS[o]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.location}</label>
                <input className="form-input"
                  value={form.location} onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.inspector}</label>
                <input className="form-input"
                  value={form.inspector} onChange={e => setForm(prev => ({ ...prev, inspector: e.target.value }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.assignedTo}</label>
                <input className="form-input"
                  value={form.assigned_to} onChange={e => setForm(prev => ({ ...prev, assigned_to: e.target.value }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.date}</label>
                <input type="date" className="form-input"
                  value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">{p.fields.closeDate}</label>
                <input type="date" className="form-input"
                  value={form.close_date} onChange={e => setForm(prev => ({ ...prev, close_date: e.target.value }))}/>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">{p.fields.observations}</label>
                <input className="form-input"
                  value={form.observations} onChange={e => setForm(prev => ({ ...prev, observations: e.target.value }))}/>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">{p.fields.actionRequired}</label>
                <input className="form-input"
                  value={form.action_required} onChange={e => setForm(prev => ({ ...prev, action_required: e.target.value }))}/>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">{p.fields.remarks}</label>
                <input className="form-input"
                  value={form.remarks} onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}/>
              </div>
            </div>
            {addErr && (
              <div style={{ fontSize: 12, color: 'var(--red)', background: '#da363318', border: '1px solid #da363344', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: 12 }}>
                {addErr}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>{t.common.cancel}</button>
              <button className="btn btn-primary" onClick={saveAdd} disabled={saving}>
                {saving ? <span className="spinner"/> : t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDel && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--red)' }}>{t.common.confirmDelete}</div>
            </div>
            <div style={{ background: 'var(--bg3)', border: '1px solid #da363333', borderRadius: 'var(--radius)', padding: 16, marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--blue)', marginBottom: 4 }}>{confirmDel.report_no}</div>
              <div style={{ fontSize: 13 }}>{confirmDel.subject}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>{t.common.cancel}</button>
              <button style={{ background: '#da363322', color: 'var(--red)', border: '1px solid #da363344', borderRadius: 'var(--radius-sm)', padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
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
