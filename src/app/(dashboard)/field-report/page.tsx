import GenericSheetClient from '@/components/tables/GenericSheetClient'
export default function FieldReportPage() {
  return <GenericSheetClient table="field_reports" title="التقارير الميدانية — Field Report"
    columns={[
      { key:'no', label:'#', type:'number', width:40 },
      { key:'report_no', label:'رقم التقرير', type:'code' },
      { key:'subject', label:'الموضوع', type:'desc' },
      { key:'date', label:'التاريخ', type:'date' },
      { key:'inspector', label:'المفتش', type:'text' },
      { key:'status', label:'الحالة', type:'status', width:100 },
    ]}
    statusOptions={[{value:'Open',label:'مفتوح'},{value:'Closed',label:'مغلق'}]}
    searchField="subject"
  />
}
