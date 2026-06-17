import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <LanguageProvider>
      <div className="layout">
        <Sidebar userEmail={user.email ?? ''} />
        <div className="main-content">{children}</div>
      </div>
    </LanguageProvider>
  )
}
