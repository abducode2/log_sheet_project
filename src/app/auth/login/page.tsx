// 'use client'
// import { useState } from 'react'
// import { useRouter } from 'next/navigation'
// import { createClient } from '@/lib/supabase/client'
// import styles from './login.module.css'

// export default function LoginPage() {
//   const router   = useRouter()
//   const supabase = createClient()

//   const [mode, setMode]         = useState<'login' | 'register'>('login')
//   const [fullName, setFullName] = useState('')
//   const [email, setEmail]       = useState('')
//   const [password, setPassword] = useState('')
//   const [confirm, setConfirm]   = useState('')
//   const [loading, setLoading]   = useState(false)
//   const [error, setError]       = useState('')
//   const [success, setSuccess]   = useState('')

//   function switchMode(m: 'login' | 'register') {
//     setMode(m); setError(''); setSuccess('')
//   }

//   async function handleSubmit(e: React.FormEvent) {
//     e.preventDefault()
//     setError(''); setSuccess('')

//     if (mode === 'register') {
//       if (password !== confirm) { setError('كلمة المرور غير متطابقة'); return }
//       if (password.length < 6)  { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
//     }

//     setLoading(true)

//     if (mode === 'login') {
//       const { error } = await supabase.auth.signInWithPassword({ email, password })
//       if (error) { setError('البريد الإلكتروني أو كلمة المرور غير صحيحة'); setLoading(false) }
//       else router.push('/dashboard')

//     } else {
//       const { data, error } = await supabase.auth.signUp({
//         email,
//         password,
//         options: { data: { full_name: fullName } },
//       })
//       if (error) {
//         setError(error.message === 'User already registered'
//           ? 'هذا البريد الإلكتروني مسجّل مسبقاً'
//           : 'حدث خطأ أثناء إنشاء الحساب، حاول مرة أخرى')
//         setLoading(false)
//       } else if (data.user && !data.session) {
//         // Email confirmation required
//         setSuccess('تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتفعيل الحساب.')
//         setLoading(false)
//       } else {
//         // Auto-confirmed (email confirmation disabled in Supabase)
//         router.push('/dashboard')
//       }
//     }
//   }

//   return (
//     <div className={styles.page}>
//       <div className={styles.card}>

//         {/* Logo */}
//         <div className={styles.logo}>
//           <div className={styles.logoIcon}>P179</div>
//           <div>
//             <div className={styles.logoTitle}>MURCIA-2 ZONE 06</div>
//             <div className={styles.logoSub}>نظام إدارة وثائق المشروع</div>
//           </div>
//         </div>

//         {/* Tabs */}
//         <div className={styles.tabs}>
//           <button
//             className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
//             onClick={() => switchMode('login')}
//             type="button"
//           >
//             تسجيل الدخول
//           </button>
//           <button
//             className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
//             onClick={() => switchMode('register')}
//             type="button"
//           >
//             إنشاء حساب
//           </button>
//         </div>

//         {/* Form */}
//         <form onSubmit={handleSubmit}>
//           {mode === 'register' && (
//             <div className="form-group">
//               <label className="form-label">الاسم الكامل</label>
//               <input
//                 className="form-input"
//                 type="text"
//                 placeholder="محمد العمري"
//                 value={fullName}
//                 onChange={e => setFullName(e.target.value)}
//                 required
//               />
//             </div>
//           )}

//           <div className="form-group">
//             <label className="form-label">البريد الإلكتروني</label>
//             <input
//               className="form-input"
//               type="email"
//               placeholder="admin@rawaf.com"
//               value={email}
//               onChange={e => setEmail(e.target.value)}
//               required
//             />
//           </div>

//           <div className="form-group">
//             <label className="form-label">كلمة المرور</label>
//             <input
//               className="form-input"
//               type="password"
//               placeholder="••••••••"
//               value={password}
//               onChange={e => setPassword(e.target.value)}
//               required
//             />
//           </div>

//           {mode === 'register' && (
//             <div className="form-group">
//               <label className="form-label">تأكيد كلمة المرور</label>
//               <input
//                 className="form-input"
//                 type="password"
//                 placeholder="••••••••"
//                 value={confirm}
//                 onChange={e => setConfirm(e.target.value)}
//                 required
//               />
//             </div>
//           )}

//           {error   && <div className={styles.error}>{error}</div>}
//           {success && <div className={styles.success}>{success}</div>}

//           <button
//             type="submit"
//             className={`btn btn-primary btn-lg ${styles.submitBtn}`}
//             disabled={loading}
//           >
//             {loading
//               ? <span className="spinner" />
//               : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
//           </button>
//         </form>

//         <div className={styles.footer}>
//           <span>مشروع MURCIA-2 · المنطقة 06 · الرياض</span>
//           <span>شركة نجا للاستشارات الهندسية</span>
//         </div>
//       </div>
//     </div>
//   )
// }
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './login.module.css'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [mode, setMode]         = useState<'login' | 'register'>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  function switchMode(m: 'login' | 'register') {
    setMode(m); setError(''); setSuccess('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')

    if (mode === 'register') {
      if (password !== confirm) { setError('كلمة المرور غير متطابقة'); return }
      if (password.length < 6)  { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    }

    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(`[login] ${error.message}`)
        setLoading(false)
      } else {
        router.push('/dashboard')
      }

    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) {
        setError(`[signup] ${error.message} (status: ${error.status})`)
        setLoading(false)
      } else if (data.user && !data.session) {
        setSuccess('تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتفعيل الحساب.')
        setLoading(false)
      } else {
        router.push('/dashboard')
      }
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>P179</div>
          <div>
            <div className={styles.logoTitle}>MURCIA-2 ZONE 06</div>
            <div className={styles.logoSub}>نظام إدارة وثائق المشروع</div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
            onClick={() => switchMode('login')}
            type="button"
          >
            تسجيل الدخول
          </button>
          <button
            className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
            onClick={() => switchMode('register')}
            type="button"
          >
            إنشاء حساب
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">الاسم الكامل</label>
              <input
                className="form-input"
                type="text"
                placeholder="محمد العمري"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">البريد الإلكتروني</label>
            <input
              className="form-input"
              type="email"
              placeholder="admin@rawaf.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">كلمة المرور</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">تأكيد كلمة المرور</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>
          )}

          {error   && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <button
            type="submit"
            className={`btn btn-primary btn-lg ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading
              ? <span className="spinner" />
              : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
          </button>
        </form>

        <div className={styles.footer}>
          <span>مشروع MURCIA-2 · المنطقة 06 · الرياض</span>
          <span>شركة نجا للاستشارات الهندسية</span>
        </div>
      </div>
    </div>
  )
}
