import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'P-216 | HARAJ-IQC-ALRAWAF',
  description: 'نظام إدارة وثائق مشروع HARAJ-IQC-ALRAWAF',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* Apply saved theme immediately before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t = localStorage.getItem('p216-theme') || 'dark';
              document.documentElement.setAttribute('data-theme', t);
              var l = localStorage.getItem('p216-lang') || 'ar';
              document.documentElement.setAttribute('lang', l);
              document.documentElement.setAttribute('dir', l === 'en' ? 'ltr' : 'rtl');
            } catch(e){}
          })();
        `}}/>
      </head>
      <body>{children}</body>
    </html>
  )
}
