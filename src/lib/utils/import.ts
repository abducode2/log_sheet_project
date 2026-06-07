
import * as XLSX from 'xlsx'

export interface ImportResult {
  success: number
  errors: string[]
}

function excelDateToISO(v: unknown): string | null {
  if (!v) return null
  if (typeof v === 'string' && v.includes('-')) return v
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000)
    return d.toISOString().slice(0, 10)
  }
  return null
}

function clean(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  return String(v).trim() || null
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

// Map Excel sheet name → parser function name
export const SHEET_MAP: Record<string, string> = {
  'SHOP DRAWING SUBMITTAL':       'shop_drawings',
  'SUPPLIER PRE-QUALIFICATION':   'supplier_prequalifications',
  'MATERIAL SUBMITTAL':           'material_submittals',
  'MATERIAL INSPECTION REQUEST':  'material_inspection_requests',
  'DOCUMENT TANSMITTAL':          'document_transmittals',
  'INSPECTION REQUEST':           'inspection_requests',
  'INSPECTION REQUEST FOR UNIFIER':'inspection_requests_unifier',
  'CPR UNIFIER':                  'cpr_unifier',
  'CONCRETE POUR REQUEST - CPR':  'concrete_pour_requests',
  'REQUEST FOR INFORMATION':      'requests_for_information',
  'NON-CONFORMANCE REPORT':       'non_conformance_reports',
  'FIELD REPORT SITE OBSERVATION':'field_reports',
  'RAWAF-NAGA':                   'letters_rawaf_naga',
  'NAGA-RAWAF':                   'letters_naga_rawaf',
}

export function parseExcelFile(file: File): Promise<Record<string, Record<string, unknown>[]>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: false })
        const result: Record<string, Record<string, unknown>[]> = {}

        for (const sheetName of wb.SheetNames) {
          const table = SHEET_MAP[sheetName]
          if (!table) continue
          const ws = wb.Sheets[sheetName]
          const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
          if (rows.length < 2) continue

          const parsed = parseSheet(table, rows)
          if (parsed.length > 0) result[table] = parsed
        }
        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

function parseSheet(table: string, rows: unknown[][]): Record<string, unknown>[] {
  // Find first non-empty row as header (skip logo/title rows)
  let headerIdx = 0
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i] as unknown[]
    const filled = row.filter(c => c !== null && c !== '').length
    if (filled >= 3) { headerIdx = i; break }
  }

  const headers = (rows[headerIdx] as unknown[]).map(h => String(h ?? '').trim().toUpperCase())
  const dataRows = rows.slice(headerIdx + 1)

  const get = (row: unknown[], ...keys: string[]) => {
    for (const k of keys) {
      const idx = headers.findIndex(h => h.includes(k))
      if (idx !== -1 && row[idx] !== null && row[idx] !== '') return row[idx]
    }
    return null
  }

  const out: Record<string, unknown>[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] as unknown[]
    if (!row || row.every(c => c === null || c === '')) continue
    const noVal = get(row, 'NO', 'NO.')
    if (!noVal && i > 0) continue

    let record: Record<string, unknown> = {}

    switch (table) {
      case 'shop_drawings':
        record = {
          no: num(get(row, 'NO', 'NO.')),
          request_no: clean(get(row, 'REQUEST NO', 'REF NO', 'CODE')),
          description: clean(get(row, 'DESCRIPTION', 'TITLE', 'DESC')),
          submission_date: excelDateToISO(get(row, 'SUBMISSION', 'SUB. DATE', 'DATE')),
          element: clean(get(row, 'ELEMENT', 'TYPE', 'DISCIPLINE')),
          rev: num(get(row, 'REV', 'REVISION')) ?? 0,
          ac_co: clean(get(row, 'AC/CO', 'STATUS', 'RESULT', 'AC.CO')),
          approval_date: excelDateToISO(get(row, 'APPROVAL', 'APP. DATE', 'APPROVED')),
          v_time: num(get(row, 'V.TIME', 'VTIME', 'DAYS')),
          remarks: clean(get(row, 'REMARKS', 'NOTES', 'COMMENT')),
        }
        break
      case 'letters_rawaf_naga':
      case 'letters_naga_rawaf':
        record = {
          no: num(get(row, 'NO', 'NO.')),
          letter_no: clean(get(row, 'LETTER NO', 'REF NO', 'CODE', 'NO')),
          subject: clean(get(row, 'SUBJECT', 'TITLE', 'DESCRIPTION', 'DESC')),
          date: excelDateToISO(get(row, 'DATE', 'LETTER DATE')),
          remarks: clean(get(row, 'REMARKS', 'NOTES')),
        }
        // fallback: use col 1 as letter_no, col 2 as subject
        if (!record.letter_no && !record.subject) {
          record.letter_no = clean(row[1])
          record.subject = clean(row[2])
          record.date = excelDateToISO(row[3])
        }
        break
      case 'material_submittals':
        record = {
          no: num(get(row, 'NO')),
          request_no: clean(get(row, 'REQUEST NO', 'REF NO')),
          description: clean(get(row, 'DESCRIPTION', 'TITLE')),
          submission_date: excelDateToISO(get(row, 'SUBMISSION', 'DATE')),
          element: clean(get(row, 'ELEMENT', 'TYPE')),
          rev: num(get(row, 'REV')) ?? 0,
          status: clean(get(row, 'STATUS', 'AC/CO', 'RESULT')),
          approval_date: excelDateToISO(get(row, 'APPROVAL', 'APP. DATE')),
          remarks: clean(get(row, 'REMARKS', 'NOTES')),
        }
        break
      case 'supplier_prequalifications':
        record = {
          no: num(get(row, 'NO')),
          supplier_name: clean(get(row, 'SUPPLIER', 'NAME', 'COMPANY')),
          trade: clean(get(row, 'TRADE', 'SCOPE', 'TYPE')),
          submission_date: excelDateToISO(get(row, 'DATE', 'SUBMISSION')),
          status: clean(get(row, 'STATUS', 'RESULT')),
          remarks: clean(get(row, 'REMARKS', 'NOTES')),
        }
        break
      case 'inspection_requests':
        record = {
          no: num(get(row, 'NO')),
          ir_no: clean(get(row, 'IR NO', 'REF NO', 'REQUEST NO')),
          description: clean(get(row, 'DESCRIPTION', 'TITLE')),
          location: clean(get(row, 'LOCATION', 'AREA')),
          request_date: excelDateToISO(get(row, 'REQUEST DATE', 'DATE')),
          inspection_date: excelDateToISO(get(row, 'INSPECTION DATE', 'INS. DATE')),
          result: clean(get(row, 'RESULT', 'STATUS')),
          remarks: clean(get(row, 'REMARKS', 'NOTES')),
        }
        break
      case 'concrete_pour_requests':
        record = {
          no: num(get(row, 'NO')),
          cpr_no: clean(get(row, 'CPR NO', 'REF NO')),
          description: clean(get(row, 'DESCRIPTION', 'ELEMENT')),
          location: clean(get(row, 'LOCATION', 'AREA')),
          pour_date: excelDateToISO(get(row, 'DATE', 'POUR DATE')),
          volume_m3: num(get(row, 'VOLUME', 'M3', 'QTY')),
          mix_design: clean(get(row, 'MIX', 'DESIGN')),
          status: clean(get(row, 'STATUS', 'RESULT')),
          remarks: clean(get(row, 'REMARKS', 'NOTES')),
        }
        break
      case 'requests_for_information':
        record = {
          no: num(get(row, 'NO')),
          rfi_no: clean(get(row, 'RFI NO', 'REF NO')),
          subject: clean(get(row, 'SUBJECT', 'TITLE', 'DESCRIPTION')),
          submission_date: excelDateToISO(get(row, 'DATE', 'SUBMISSION')),
          response_date: excelDateToISO(get(row, 'RESPONSE', 'REPLY DATE')),
          status: clean(get(row, 'STATUS', 'RESULT')),
          remarks: clean(get(row, 'REMARKS', 'NOTES')),
        }
        break
      case 'non_conformance_reports':
        record = {
          no: num(get(row, 'NO')),
          ncr_no: clean(get(row, 'NCR NO', 'REF NO')),
          description: clean(get(row, 'DESCRIPTION', 'TITLE')),
          location: clean(get(row, 'LOCATION', 'AREA')),
          issue_date: excelDateToISO(get(row, 'ISSUE DATE', 'DATE')),
          close_date: excelDateToISO(get(row, 'CLOSE DATE', 'CLOSED')),
          status: clean(get(row, 'STATUS')),
          corrective_action: clean(get(row, 'CORRECTIVE', 'ACTION')),
          remarks: clean(get(row, 'REMARKS', 'NOTES')),
        }
        break
      case 'field_reports':
        record = {
          no: num(get(row, 'NO')),
          report_no: clean(get(row, 'REPORT NO', 'REF NO')),
          subject: clean(get(row, 'SUBJECT', 'TITLE', 'DESCRIPTION')),
          date: excelDateToISO(get(row, 'DATE')),
          inspector: clean(get(row, 'INSPECTOR', 'BY')),
          status: clean(get(row, 'STATUS')),
        }
        break
      case 'document_transmittals':
        record = {
          no: num(get(row, 'NO')),
          transmittal_no: clean(get(row, 'TRANSMITTAL NO', 'REF NO')),
          subject: clean(get(row, 'SUBJECT', 'TITLE', 'DESCRIPTION')),
          date: excelDateToISO(get(row, 'DATE')),
          from_party: clean(get(row, 'FROM')),
          to_party: clean(get(row, 'TO')),
          no_of_copies: num(get(row, 'COPIES', 'NO OF COPIES')) ?? 1,
          remarks: clean(get(row, 'REMARKS', 'NOTES')),
        }
        break
      case 'material_inspection_requests':
        record = {
          no: num(get(row, 'NO')),
          mir_no: clean(get(row, 'MIR NO', 'REF NO')),
          description: clean(get(row, 'DESCRIPTION', 'TITLE')),
          request_date: excelDateToISO(get(row, 'REQUEST DATE', 'DATE')),
          inspection_date: excelDateToISO(get(row, 'INSPECTION DATE')),
          result: clean(get(row, 'RESULT', 'STATUS')),
          remarks: clean(get(row, 'REMARKS', 'NOTES')),
        }
        break
      case 'inspection_requests_unifier':
        record = {
          no: num(get(row, 'NO')),
          ir_no: clean(get(row, 'IR NO', 'REF NO')),
          unifier_no: clean(get(row, 'UNIFIER', 'UNIFIER NO')),
          description: clean(get(row, 'DESCRIPTION', 'TITLE')),
          date: excelDateToISO(get(row, 'DATE')),
          status: clean(get(row, 'STATUS')),
          remarks: clean(get(row, 'REMARKS')),
        }
        break
      case 'cpr_unifier':
        record = {
          no: num(get(row, 'NO')),
          cpr_no: clean(get(row, 'CPR NO', 'REF NO')),
          unifier_no: clean(get(row, 'UNIFIER', 'UNIFIER NO')),
          description: clean(get(row, 'DESCRIPTION', 'TITLE')),
          date: excelDateToISO(get(row, 'DATE')),
          status: clean(get(row, 'STATUS')),
          remarks: clean(get(row, 'REMARKS')),
        }
        break
    }

    // Only add if has meaningful data
    const vals = Object.values(record).filter(v => v !== null && v !== undefined)
    if (vals.length >= 2) out.push(record)
  }

  return out
}
