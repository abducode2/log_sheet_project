'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useRole } from '@/lib/hooks/useRole'
import { useTheme, type Theme } from '@/lib/hooks/useTheme'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { type Lang } from '@/lib/i18n/translations'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Nav config (key-based, no hardcoded labels) ───────────
type NavItem = { href: string; key: keyof ReturnType<typeof useLanguage>['t']['nav']['items']; dot: string; countKey: string | null; adminOnly?: boolean }
type NavSection = { sectionKey: keyof ReturnType<typeof useLanguage>['t']['nav']['sections']; items: NavItem[] }

const NAV: NavSection[] = [
  { sectionKey: 'main', items: [
    { href: '/dashboard', key: 'dashboard',  dot: '#58a6ff', countKey: null },
    { href: '/import',    key: 'import',     dot: '#3fb950', countKey: null },
  ]},
  { sectionKey: 'documents', items: [
    { href: '/shop-drawings', key: 'shopDrawings',  dot: '#58a6ff', countKey: 'shop_drawings' },
    { href: '/materials',     key: 'materials',     dot: '#3fb950', countKey: 'material_submittals' },
    { href: '/supplier',      key: 'supplier',      dot: '#d29922', countKey: 'supplier_prequalifications' },
    { href: '/inspection',    key: 'inspection',    dot: '#bc8cff', countKey: 'inspection_requests' },
    { href: '/cpr',           key: 'cpr',           dot: '#f85149', countKey: 'concrete_pour_requests' },
    { href: '/rfi',           key: 'rfi',           dot: '#39d353', countKey: 'requests_for_information' },
    { href: '/ncr',           key: 'ncr',           dot: '#ff7b72', countKey: 'non_conformance_reports' },
    { href: '/pouring-log',   key: 'pouringLog',    dot: '#ffa657', countKey: 'pouring_log' },
    { href: '/field-report',  key: 'fieldReport',   dot: '#8b949e', countKey: 'field_reports' },
    { href: '/transmittal',   key: 'transmittal',   dot: '#8b949e', countKey: 'document_transmittals' },
  ]},
  { sectionKey: 'letters', items: [
    { href: '/letters/rawaf-naga', key: 'rawafNaga', dot: '#ffa657', countKey: 'letters_rawaf_naga' },
    { href: '/letters/naga-rawaf', key: 'nagaRawaf', dot: '#f85149', countKey: 'letters_naga_rawaf' },
  ]},
  { sectionKey: 'reports', items: [
    { href: '/reports', key: 'periodicReport', dot: '#e3b341', countKey: null },
  ]},
  { sectionKey: 'admin', items: [
    { href: '/users', key: 'users', dot: '#58a6ff', countKey: null, adminOnly: true },
  ]},
]

const TABLES = [
  'shop_drawings','material_submittals','supplier_prequalifications',
  'inspection_requests','concrete_pour_requests','requests_for_information',
  'non_conformance_reports','field_reports','document_transmittals',
  'letters_rawaf_naga','letters_naga_rawaf','pouring_log',
]

const THEMES: { id: Theme; label: (t: ReturnType<typeof useLanguage>['t']) => string; colors: [string, string, string] }[] = [
  { id: 'dark',     label: t => t.theme.dark,     colors: ['#0d1117', '#161b22', '#58a6ff'] },
  { id: 'light',    label: t => t.theme.light,    colors: ['#f6f8fa', '#ffffff', '#0969da'] },
  { id: 'midnight', label: t => t.theme.midnight, colors: ['#010409', '#0d1117', '#4facf7'] },
]

const LANGS: { id: Lang; flag: string }[] = [
  { id: 'ar', flag: '🇸🇦' },
  { id: 'en', flag: '🇬🇧' },
]

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname          = usePathname()
  const router            = useRouter()
  const supabase          = createClient()
  const { isAdmin }       = useRole()
  const { theme, changeTheme } = useTheme()
  const { lang, t, setLang }  = useLanguage()
  const [counts, setCounts]   = useState<Record<string, number>>({})

  useEffect(() => {
    async function fetchCounts() {
      const results = await Promise.all(
        TABLES.map(table =>
          supabase.from(table).select('*', { count: 'exact', head: true })
            .then(({ count }) => ({ table, count: count ?? 0 }))
        )
      )
      const shopRoot = await supabase
        .from('shop_drawings').select('*', { count: 'exact', head: true }).is('parent_id', null)
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
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">P216</div>
        <div>
          <div className="sidebar-logo-text">{t.project.name}</div>
          <div className="sidebar-logo-sub">{t.project.sub}</div>
        </div>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <input placeholder={t.search}/>
      </div>

      {/* Navigation */}
      {NAV.map(section => (
        <div key={section.sectionKey} className="nav-section">
          <div className="nav-label">{t.nav.sections[section.sectionKey]}</div>
          {section.items
            .filter(item => !item.adminOnly || isAdmin)
            .map(item => (
              <button
                key={item.href}
                className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
                onClick={() => router.push(item.href)}
              >
                <span className="nav-dot" style={{ background: item.dot }}/>
                {t.nav.items[item.key]}
                {item.countKey && counts[item.countKey] !== undefined && (
                  <span className="nav-count">{counts[item.countKey]}</span>
                )}
              </button>
            ))}
        </div>
      ))}

      {/* Footer */}
      <div className="sidebar-footer">

        {/* Theme switcher */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, padding: '0 2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {t.theme.label}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {THEMES.map(th => (
              <button
                key={th.id}
                title={th.label(t)}
                onClick={() => changeTheme(th.id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '6px 4px', borderRadius: 'var(--radius)',
                  border: theme === th.id ? '2px solid var(--accent)' : '2px solid var(--border)',
                  background: theme === th.id ? 'var(--accent)11' : 'transparent',
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                <div style={{
                  width: 32, height: 22, borderRadius: 4, overflow: 'hidden',
                  display: 'grid', gridTemplateColumns: '40% 60%',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ background: th.colors[0] }}/>
                  <div style={{ background: th.colors[1], display: 'flex', alignItems: 'flex-end', padding: 2 }}>
                    <div style={{ width: '100%', height: 3, borderRadius: 2, background: th.colors[2] }}/>
                  </div>
                </div>
                <span style={{ fontSize: 9, color: theme === th.id ? 'var(--accent)' : 'var(--text3)', fontWeight: theme === th.id ? 600 : 400 }}>
                  {th.label(t)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Language switcher */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, padding: '0 2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {t.lang.label}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {LANGS.map(l => (
              <button
                key={l.id}
                onClick={() => setLang(l.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '7px 8px', borderRadius: 'var(--radius)',
                  border: lang === l.id ? '2px solid var(--accent)' : '2px solid var(--border)',
                  background: lang === l.id ? 'var(--accent)11' : 'transparent',
                  cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>{l.flag}</span>
                <span style={{ fontSize: 11, fontWeight: lang === l.id ? 700 : 400, color: lang === l.id ? 'var(--accent)' : 'var(--text2)' }}>
                  {t.lang[l.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, padding: '0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {userEmail}
        </div>

        <button className="nav-item" onClick={logout} style={{ color: 'var(--red)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {t.logout}
        </button>
      </div>
    </aside>
  )
}
