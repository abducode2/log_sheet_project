
'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV_STATIC = [
  { label: 'الرئيسية', items: [
    { href:'/dashboard', label:'لوحة التحكم',   dot:'#58a6ff', countKey: null },
    { href:'/import',    label:'استيراد Excel', dot:'#3fb950',  countKey: null },
  ]},
  { label: 'وثائق المشروع', items: [
    { href:'/shop-drawings',  label:'رسومات التنفيذ',       dot:'#58a6ff', countKey:'shop_drawings' },
    { href:'/materials',      label:'تقديمات المواد',        dot:'#3fb950', countKey:'material_submittals' },
    { href:'/supplier',       label:'تأهيل الموردين',        dot:'#d29922', countKey:'supplier_prequalifications' },
    { href:'/inspection',     label:'طلبات الفحص',          dot:'#bc8cff', countKey:'inspection_requests' },
    { href:'/cpr',            label:'طلبات الصب CPR',       dot:'#f85149', countKey:'concrete_pour_requests' },
    { href:'/rfi',            label:'طلبات الاستيضاح RFI',  dot:'#39d353', countKey:'requests_for_information' },
    { href:'/ncr',            label:'تقارير عدم المطابقة',  dot:'#ff7b72', countKey:'non_conformance_reports' },
    { href:'/field-report',   label:'التقارير الميدانية',    dot:'#8b949e', countKey:'field_reports' },
    { href:'/transmittal',    label:'إرسال الوثائق',        dot:'#8b949e', countKey:'document_transmittals' },
  ]},
  { label: 'المراسلات', items: [
    { href:'/letters/rawaf-naga', label:'الرواف ← نجا', dot:'#ffa657', countKey:'letters_rawaf_naga' },
    { href:'/letters/naga-rawaf', label:'نجا ← الرواف', dot:'#f85149', countKey:'letters_naga_rawaf' },
  ]},
]

const TABLES = [
  'shop_drawings',
  'material_submittals',
  'supplier_prequalifications',
  'inspection_requests',
  'concrete_pour_requests',
  'requests_for_information',
  'non_conformance_reports',
  'field_reports',
  'document_transmittals',
  'letters_rawaf_naga',
  'letters_naga_rawaf',
]

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    async function fetchCounts() {
      const results = await Promise.all(
        TABLES.map(table =>
          supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            // For shop_drawings count only root drawings
            .then(({ count }) => ({ table, count: count ?? 0 }))
        )
      )
      // For shop_drawings: count only root rows (no parent_id)
      const shopRoot = await supabase
        .from('shop_drawings')
        .select('*', { count: 'exact', head: true })
        .is('parent_id', null)

      const map: Record<string, number> = {}
      for (const r of results) map[r.table] = r.count
      map['shop_drawings'] = shopRoot.count ?? 0
      setCounts(map)
    }
    fetchCounts()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">P216</div>
        <div>
          <div className="sidebar-logo-text">MURCIA-2 ZONE 06</div>
          <div className="sidebar-logo-sub">شركة الرواف للمقاولات</div>
        </div>
      </div>

      <div className="sidebar-search">
        <input placeholder="بحث سريع..." />
      </div>

      {NAV_STATIC.map(section => (
        <div key={section.label} className="nav-section">
          <div className="nav-label">{section.label}</div>
          {section.items.map(item => (
            <button
              key={item.href}
              className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
              onClick={() => router.push(item.href)}
            >
              <span className="nav-dot" style={{ background: item.dot }} />
              {item.label}
              {item.countKey && counts[item.countKey] !== undefined && (
                <span className="nav-count">{counts[item.countKey]}</span>
              )}
            </button>
          ))}
        </div>
      ))}

      <div className="sidebar-footer">
        <div style={{ fontSize:10, color:'var(--text3)', marginBottom:8, padding:'0 2px' }}>
          {userEmail}
        </div>
        <button className="nav-item" onClick={logout} style={{ color:'var(--red)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          تسجيل الخروج
        </button>
      </div>
    </aside>
  )
}
