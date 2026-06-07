import GenericSheetClient from '@/components/tables/GenericSheetClient'
export default function NcrPage() {
  return <GenericSheetClient table="non_conformance_reports" title="تقارير عدم المطابقة — NCR"
    columns={[
      { key:'no', label:'#', type:'number', width:40 },
      { key:'ncr_no', label:'رقم NCR', type:'code' },
      { key:'description', label:'الوصف', type:'desc' },
      { key:'location', label:'الموقع', type:'text' },
      { key:'issue_date', label:'تاريخ الإصدار', type:'date' },
      { key:'close_date', label:'تاريخ الإغلاق', type:'date' },
      { key:'status', label:'الحالة', type:'status', width:100 },
    ]}
    statusOptions={[{value:'Open',label:'مفتوح'},{value:'Closed',label:'مغلق'}]}
  />
}
