import { createClient } from '@/lib/supabase/server'
import DashboardContent from './DashboardContent'

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

  const shopRows = (recentShop ?? []).map((r: Record<string, unknown>) => [
    { type: 'code' as const,    value: String(r.request_no ?? '') },
    { type: 'desc' as const,    value: String(r.description ?? '') },
    { type: 'element' as const, value: String(r.element ?? '') },
    { type: 'status' as const,  value: String(r.ac_co ?? '') },
  ])

  const letterRows = (recentLetters ?? []).map((r: Record<string, unknown>) => [
    { type: 'code' as const, value: String(r.no ?? '') },
    { type: 'desc' as const, value: String(r.subject ?? '') },
    { type: 'date' as const, value: String(r.date ?? '') },
  ])

  return <DashboardContent stats={stats} recentShop={shopRows} recentLetters={letterRows} />
}
