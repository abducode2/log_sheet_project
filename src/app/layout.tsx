import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'P-179 | MURCIA-2 ZONE 06',
  description: 'نظام إدارة وثائق مشروع MURCIA-2 ZONE 06',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
