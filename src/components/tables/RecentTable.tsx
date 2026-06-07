import Link from 'next/link'
import { getStatusColor, getElementColor } from '@/lib/utils'

type CellType = { type: 'code'|'desc'|'element'|'status'|'date'; value: string }

interface Props {
  title: string
  columns: string[]
  rows: CellType[][]
  href: string
}

export default function RecentTable({ title, columns, rows, href }: Props) {
  function renderCell(cell: CellType) {
    switch (cell.type) {
      case 'code':    return <span className="cell-mono cell-blue">{cell.value}</span>
      case 'desc':    return <span className="cell-desc">{cell.value}</span>
      case 'element': return <span className={`el-badge el-${cell.value.toLowerCase()}`}>{cell.value}</span>
      case 'status':  return <span className={`st-badge ${getStatusColor(cell.value)}`}>{cell.value}</span>
      case 'date':    return <span className="cell-mono cell-muted">{cell.value ?? '—'}</span>
      default:        return <span>{cell.value}</span>
    }
  }

  return (
    <div className="table-wrap">
      <div className="table-header">
        <span className="table-title">{title}</span>
        <Link href={href} style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none' }}>
          عرض الكل ←
        </Link>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>{row.map((cell, j) => <td key={j}>{renderCell(cell)}</td>)}</tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px' }}>لا توجد بيانات</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
