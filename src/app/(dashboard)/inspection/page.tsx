import GenericSheetClient from '@/components/tables/GenericSheetClient'
export default function InspectionPage() {
  return <GenericSheetClient table="inspection_requests" title="طلبات الفحص — Inspection Request"
    columns={[
      { key:'no', label:'#', type:'number', width:40 },
      { key:'ir_no', label:'رقم الطلب', type:'code' },
      { key:'description', label:'الوصف', type:'desc' },
      { key:'location', label:'الموقع', type:'text' },
      { key:'request_date', label:'تاريخ الطلب', type:'date' },
      { key:'inspection_date', label:'تاريخ الفحص', type:'date' },
      { key:'result', label:'النتيجة', type:'status', width:110 },
    ]}
    statusOptions={[{value:'Approved',label:'معتمد'},{value:'Rejected',label:'مرفوض'},{value:'Pending',label:'انتظار'}]}
    searchField="ir_no"
  />
}
