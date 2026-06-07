export function cn(...inputs: (string | undefined | false | null)[]): string {
  return inputs.filter(Boolean).join(' ')
}

/** Convert Excel serial date (e.g. 45287) to YYYY-MM-DD */
export function excelDateToISO(serial: number | null | undefined): string | null {
  if (!serial || isNaN(serial)) return null
  const d = new Date((serial - 25569) * 86400 * 1000)
  return d.toISOString().slice(0, 10)
}

/** Format ISO date to Arabic-friendly display */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/** Status label map */
export const STATUS_LABELS: Record<string, string> = {
  A: 'معتمد',
  B: 'معتمد مع ملاحظات',
  C: 'مراجعة وإعادة تقديم',
  D: 'مرفوض',
  P: 'قيد الانتظار',
}

export const ELEMENT_LABELS: Record<string, string> = {
  AR: 'معماري',
  SC: 'إنشائي',
  SU: 'مساحة',
  ME: 'ميكانيكي',
  EL: 'كهربائي',
  GEN: 'عام',
}

export function getStatusColor(status: string) {
  const map: Record<string, string> = {
    A: 'status-a',
    B: 'status-b',
    C: 'status-c',
    D: 'status-d',
    P: 'status-p',
  }
  return map[status] ?? 'status-p'
}

export function getElementColor(el: string) {
  const map: Record<string, string> = {
    AR: 'el-ar',
    SC: 'el-sc',
    SU: 'el-su',
    ME: 'el-me',
    EL: 'el-el',
    GEN: 'el-gen',
  }
  return map[el] ?? 'el-gen'
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms = 300) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
