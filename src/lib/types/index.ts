// ─────────────────────────────────────────────────────────
//  src/lib/types/index.ts  –  All database types for P-179
// ─────────────────────────────────────────────────────────

export type StatusCode = 'A' | 'B' | 'C' | 'D' | 'P'
export type ElementCode = 'AR' | 'SC' | 'SU' | 'ME' | 'EL' | 'GEN'
export type UserRole = 'admin' | 'editor' | 'viewer'

// ── Auth ──────────────────────────────────────────────────
export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  company: string
  created_at: string
}

// ── 1. Shop Drawing Submittal ─────────────────────────────
export interface ShopDrawing {
  id: string
  project_id: string
  no: number
  request_no: string
  description: string
  submission_date: string | null
  element: ElementCode
  rev: number
  ac_co: StatusCode
  approval_date: string | null
  v_time: number | null
  remarks: string | null
  created_at: string
  updated_at: string
}

// ── 2. Supplier Pre-Qualification ────────────────────────
export interface SupplierPreQual {
  id: string
  project_id: string
  no: number
  supplier_name: string
  trade: string
  submission_date: string | null
  status: StatusCode
  remarks: string | null
  created_at: string
}

// ── 3. Material Submittal ────────────────────────────────
export interface MaterialSubmittal {
  id: string
  project_id: string
  no: number
  request_no: string
  description: string
  submission_date: string | null
  element: ElementCode
  rev: number
  status: StatusCode
  approval_date: string | null
  remarks: string | null
  created_at: string
}

// ── 4. Material Inspection Request ──────────────────────
export interface MaterialInspection {
  id: string
  project_id: string
  no: number
  mir_no: string
  description: string
  request_date: string | null
  inspection_date: string | null
  result: 'Pass' | 'Fail' | 'Pending'
  remarks: string | null
  created_at: string
}

// ── 5. Document Transmittal ──────────────────────────────
export interface DocumentTransmittal {
  id: string
  project_id: string
  no: number
  transmittal_no: string
  subject: string
  date: string | null
  from_party: string
  to_party: string
  no_of_copies: number
  remarks: string | null
  created_at: string
}

// ── 6. Inspection Request ────────────────────────────────
export interface InspectionRequest {
  id: string
  project_id: string
  no: number
  ir_no: string
  description: string
  location: string | null
  request_date: string | null
  inspection_date: string | null
  result: 'Approved' | 'Rejected' | 'Conditional' | 'Pending'
  remarks: string | null
  created_at: string
}

// ── 7. Inspection Request for Unifier ───────────────────
export interface InspectionRequestUnifier {
  id: string
  project_id: string
  no: number
  ir_no: string
  unifier_no: string
  description: string
  date: string | null
  status: string | null
  remarks: string | null
  created_at: string
}

// ── 8. CPR Unifier ───────────────────────────────────────
export interface CprUnifier {
  id: string
  project_id: string
  no: number
  cpr_no: string
  unifier_no: string
  description: string
  date: string | null
  status: string | null
  remarks: string | null
  created_at: string
}

// ── 9. Concrete Pour Request ─────────────────────────────
export interface ConcretePourRequest {
  id: string
  project_id: string
  no: number
  cpr_no: string
  description: string
  location: string | null
  pour_date: string | null
  volume_m3: number | null
  mix_design: string | null
  status: 'Approved' | 'Rejected' | 'Pending'
  remarks: string | null
  created_at: string
}

// ── 10. Request for Information ──────────────────────────
export interface RequestForInformation {
  id: string
  project_id: string
  no: number
  rfi_no: string
  subject: string
  question: string | null
  answer: string | null
  submission_date: string | null
  response_date: string | null
  status: 'Open' | 'Closed' | 'Pending'
  remarks: string | null
  created_at: string
}

// ── 11. Non-Conformance Report ───────────────────────────
export interface NonConformanceReport {
  id: string
  project_id: string
  no: number
  ncr_no: string
  description: string
  location: string | null
  issue_date: string | null
  close_date: string | null
  status: 'Open' | 'Closed'
  corrective_action: string | null
  remarks: string | null
  created_at: string
}

// ── 12. Field Report / Site Observation ──────────────────
export interface FieldReport {
  id: string
  project_id: string
  no: number
  report_no: string
  subject: string
  date: string | null
  inspector: string | null
  observations: string | null
  action_required: string | null
  status: 'Open' | 'Closed'
  created_at: string
}

// ── 13. Rawaf → Naga Letters ────────────────────────────
export interface LetterRawafNaga {
  id: string
  project_id: string
  no: number
  letter_no: string
  subject: string
  date: string | null
  remarks: string | null
  created_at: string
}

// ── 14. Naga → Rawaf Letters ────────────────────────────
export interface LetterNagaRawaf {
  id: string
  project_id: string
  no: number
  letter_no: string
  subject: string
  date: string | null
  remarks: string | null
  created_at: string
}

// ── Generic pagination ───────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

export interface FilterParams {
  search?: string
  status?: string
  element?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}
