import GenericSheetClient from '@/components/tables/GenericSheetClient'
export default function TransmittalPage() {
  return <GenericSheetClient table="document_transmittals" title="إرسال الوثائق — Document Transmittal"
    columns={[
      { key:'no', label:'#', type:'number', width:40 },
      { key:'transmittal_no', label:'رقم الإرسال', type:'code' },
      { key:'subject', label:'الموضوع', type:'desc' },
      { key:'date', label:'التاريخ', type:'date' },
      { key:'from_party', label:'من', type:'text' },
      { key:'to_party', label:'إلى', type:'text' },
      { key:'remarks', label:'ملاحظات', type:'desc' },
    ]}
    searchField="subject"
  />
}
