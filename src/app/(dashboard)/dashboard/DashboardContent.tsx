'use client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Topbar from '@/components/layout/Topbar'
import StatsGrid from '@/components/layout/StatsGrid'
import RecentTable from '@/components/tables/RecentTable'

interface Stats { total: number; approved: number; revision: number; rwfNag: number; nagRwf: number }
type CellRow = { type: 'code'|'desc'|'element'|'status'|'date'; value: string }[]

interface Props {
  stats: Stats
  recentShop: CellRow[]
  recentLetters: CellRow[]
}

export default function DashboardContent({ stats, recentShop, recentLetters }: Props) {
  const { t } = useLanguage()
  const p = t.pages.dashboard

  return (
    <>
      <Topbar title={p.title} sub={p.sub} />
      <div className="page-content anim">
        <StatsGrid stats={stats} />
        <div className="two-col">
          <RecentTable
            title={p.recentShop}
            columns={[p.colCode, p.colDesc, p.colElement, p.colStatus]}
            rows={recentShop}
            href="/shop-drawings"
            viewAllText={t.common.viewAll}
            noDataText={t.common.noData}
          />
          <RecentTable
            title={p.recentLetters}
            columns={[p.colNo, p.colSubject, p.colDate]}
            rows={recentLetters}
            href="/letters/naga-rawaf"
            viewAllText={t.common.viewAll}
            noDataText={t.common.noData}
          />
        </div>
      </div>
    </>
  )
}
