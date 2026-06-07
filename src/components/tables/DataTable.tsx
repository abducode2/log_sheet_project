'use client'
import { useState, useCallback } from 'react'
import { getStatusColor, getElementColor } from '@/lib/utils'

export type ColDef = {
  key: string
  label: string
  type?: 'text'|'code'|'desc'|'element'|'status'|'date'|'mono'|'number'
  width?: number
}

interface Props {
  columns: ColDef[]
  data: Record<string, unknown>[]
  total: number
  page: number
  pageSize?: number
  onPageChange: (p: number) => void
  onSearch?: (q: string) => void
  onFilterStatus?: (s: string) => void
  statusOptions?: { value: string; label: string }[]
  loading?: boolean
  onAdd?: () => void
  addLabel?: string
  title?: string
}

const PG = 10

export default function DataTable({
  columns, data, total, page, pageSize = PG,
  onPageChange, onSearch, onFilterStatus,
  statusOptions, loading, onAdd, addLabel, title,
}: Props) {
  const [q, setQ] = useState('')
  const [activeSt, setActiveSt] = useState('all')
  const pages = Math.ceil(total / pageSize) || 1

  const handleSearch = useCallback((v: string) => {
    setQ(v); onSearch?.(v)
  }, [onSearch])

  const handleStatus = useCallback((s: string) => {
    setActiveSt(s); onFilterStatus?.(s)
  }, [onFilterStatus])

  function renderCell(col: ColDef, row: Record<string, unknown>) {
    const val = String(row[col.key] ?? '—')
    switch (col.type) {
      case 'code':    return <span className="cell-mono cell-blue">{val}</span>
      case 'desc':    return <span className="cell-desc" title={val}>{val}</span>
      case 'mono':    return <span className="cell-mono cell-muted">{val}</span>
      case 'number':  return <span className="cell-mono cell-dim">{val}</span>
      case 'date':    return <span className="cell-mono cell-muted">{val}</span>
      case 'element': return <span className={`el-badge el-${val.toLowerCase()}`}>{val}</span>
      case 'status':  return <span className={`st-badge ${getStatusColor(val)}`}>{val}</span>
      default:        return <span>{val}</span>
    }
  }

  return (
    <div>
      <div className="toolbar">
        {onSearch && (
          <div className="search-wrap">
            <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              placeholder="بحث..."
              value={q}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
        )}
        {statusOptions && (
          <>
            <button
              className={`filter-chip ${activeSt === 'all' ? 'active' : ''}`}
              onClick={() => handleStatus('all')}
            >
              الكل ({total})
            </button>
            {statusOptions.map(opt => (
              <button
                key={opt.value}
                className={`filter-chip ${activeSt === opt.value ? 'active' : ''}`}
                onClick={() => handleStatus(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </>
        )}
        {onAdd && (
          <button className="btn btn-primary btn-sm" onClick={onAdd} style={{ marginRight: 'auto' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {addLabel ?? 'إضافة'}
          </button>
        )}
      </div>

      <div className="table-wrap">
        {title && (
          <div className="table-header">
            <span className="table-title">{title}</span>
            <span className="table-meta">{total} سجل · صفحة {page} من {pages}</span>
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map(c => (
                  <th key={c.key} style={c.width ? { width: c.width } : {}}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="loading-overlay"><div className="spinner" /><span>جارٍ التحميل...</span></div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <div className="empty-title">لا توجد نتائج</div>
                      <div className="empty-sub">جرّب تغيير معايير البحث أو الفلترة</div>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row, i) => (
                  <tr key={i}>
                    {columns.map(col => <td key={col.key}>{renderCell(col, row)}</td>)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
            إجمالي {total} سجل
          </span>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => (
            <button
              key={i}
              className={`pg-btn ${page === i + 1 ? 'active' : ''}`}
              onClick={() => onPageChange(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
