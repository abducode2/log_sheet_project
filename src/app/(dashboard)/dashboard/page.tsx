import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/layout/Topbar'
import StatsGrid from '@/components/layout/StatsGrid'
import RecentTable from '@/components/tables/RecentTable'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [shopCount, rwfNagCount, nagRwfCount, bCount, cCount] = await Promise.all([
    supabase.from('shop_drawings').select('*', { count: 'exact', head: true }),
    supabase.from('letters_rawaf_naga').select('*', { count: 'exact', head: true }),
    supabase.from('letters_naga_rawaf').select('*', { count: 'exact', head: true }),
    supabase.from('shop_drawings').select('*', { count: 'exact', head: true }).eq('ac_co', 'B'),
    supabase.from('shop_drawings').select('*', { count: 'exact', head: true }).eq('ac_co', 'C'),
  ])

  const stats = {
    total:    shopCount.count   ?? 0,
    approved: bCount.count      ?? 0,
    revision: cCount.count      ?? 0,
    rwfNag:   rwfNagCount.count ?? 0,
    nagRwf:   nagRwfCount.count ?? 0,
  }

  const { data: recentShop }    = await supabase.from('shop_drawings').select('*').order('created_at', { ascending: false }).limit(5)
  const { data: recentLetters } = await supabase.from('letters_naga_rawaf').select('*').order('created_at', { ascending: false }).limit(5)

  return (
    <>
      <Topbar title="لوحة التحكم" sub="MURCIA-2 · Zone 06 · P-179 · الرياض" />
      <div className="page-content anim">
        <StatsGrid stats={stats} />
        <div className="two-col">
          <RecentTable
            title="آخر رسومات التنفيذ"
            columns={['الكود', 'الوصف', 'العنصر', 'الحالة']}
            rows={(recentShop ?? []).map((r: Record<string, unknown>) => [
              { type: 'code' as const,    value: String(r.request_no ?? '') },
              { type: 'desc' as const,    value: String(r.description ?? '') },
              { type: 'element' as const, value: String(r.element ?? '') },
              { type: 'status' as const,  value: String(r.ac_co ?? '') },
            ])}
            href="/shop-drawings"
          />
          <RecentTable
            title="آخر خطابات نجا ← الرواف"
            columns={['#', 'موضوع الخطاب', 'التاريخ']}
            rows={(recentLetters ?? []).map((r: Record<string, unknown>) => [
              { type: 'code' as const, value: String(r.no ?? '') },
              { type: 'desc' as const, value: String(r.subject ?? '') },
              { type: 'date' as const, value: String(r.date ?? '') },
            ])}
            href="/letters/naga-rawaf"
          />
        </div>
      </div>
    </>
  )
}
