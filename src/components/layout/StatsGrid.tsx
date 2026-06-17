'use client'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Stats {
  total: number
  approved: number
  revision: number
  rwfNag: number
  nagRwf: number
}

export default function StatsGrid({ stats }: { stats: Stats }) {
  const router = useRouter()
  const { t } = useLanguage()
  const s = t.pages.dashboard.stats

  const cards = [
    { num: stats.total,    label: s.totalDrawings,      color: 'var(--blue)',   pct: 100, href: '/shop-drawings' },
    { num: stats.approved, label: s.approvedB,          color: 'var(--green)',  pct: Math.round(stats.approved/stats.total*100) || 0, href: '/shop-drawings?status=B' },
    { num: stats.revision, label: s.revisionC,          color: 'var(--amber)',  pct: Math.round(stats.revision/stats.total*100) || 0, href: '/shop-drawings?status=C' },
    { num: stats.rwfNag,   label: s.contractorLetters,  color: 'var(--orange)', pct: Math.round(stats.rwfNag/(stats.rwfNag+stats.nagRwf)*100) || 0, href: '/letters/rawaf-naga' },
    { num: stats.nagRwf,   label: s.consultantLetters,  color: 'var(--red)',    pct: 100, href: '/letters/naga-rawaf' },
  ]

  return (
    <div className="stats-grid">
      {cards.map(c => (
        <div key={c.label} className="stat-card" onClick={() => router.push(c.href)}>
          <div className="stat-num" style={{ color: c.color }}>{c.num}</div>
          <div className="stat-label">{c.label}</div>
          <div className="stat-bar">
            <div className="stat-fill" style={{ width: `${c.pct}%`, background: c.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}
