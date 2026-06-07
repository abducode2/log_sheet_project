import GenericSheetClient from '@/components/tables/GenericSheetClient'
export default function CprPage() {
  return <GenericSheetClient table="concrete_pour_requests" title="طلبات الصب — Concrete Pour Request"
    columns={[
      { key:'no', label:'#', type:'number', width:40 },
      { key:'cpr_no', label:'رقم الطلب', type:'code' },
      { key:'description', label:'الوصف', type:'desc' },
      { key:'location', label:'الموقع', type:'text' },
      { key:'pour_date', label:'تاريخ الصب', type:'date' },
      { key:'volume_m3', label:'الحجم م³', type:'number', width:80 },
      { key:'status', label:'الحالة', type:'status', width:110 },
    ]}
    statusOptions={[{value:'Approved',label:'معتمد'},{value:'Rejected',label:'مرفوض'},{value:'Pending',label:'انتظار'}]}
    searchField="cpr_no"
  />
}
