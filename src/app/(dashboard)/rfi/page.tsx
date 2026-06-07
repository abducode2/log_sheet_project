import GenericSheetClient from '@/components/tables/GenericSheetClient'
export default function RfiPage() {
  return <GenericSheetClient table="requests_for_information" title="طلبات الاستيضاح — RFI"
    columns={[
      { key:'no', label:'#', type:'number', width:40 },
      { key:'rfi_no', label:'رقم RFI', type:'code' },
      { key:'subject', label:'الموضوع', type:'desc' },
      { key:'submission_date', label:'تاريخ التقديم', type:'date' },
      { key:'response_date', label:'تاريخ الرد', type:'date' },
      { key:'status', label:'الحالة', type:'status', width:100 },
    ]}
    statusOptions={[{value:'Open',label:'مفتوح'},{value:'Closed',label:'مغلق'},{value:'Pending',label:'انتظار'}]}
    searchField="subject"
  />
}
