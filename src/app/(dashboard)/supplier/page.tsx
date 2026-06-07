import GenericSheetClient from '@/components/tables/GenericSheetClient'
export default function SupplierPage() {
  return <GenericSheetClient table="supplier_prequalifications" title="تأهيل الموردين — Supplier Pre-Qualification"
    columns={[
      { key:'no', label:'#', type:'number', width:40 },
      { key:'supplier_name', label:'اسم المورد', type:'desc' },
      { key:'trade', label:'التخصص', type:'text' },
      { key:'submission_date', label:'تاريخ التقديم', type:'date' },
      { key:'status', label:'الحالة', type:'status', width:110 },
      { key:'remarks', label:'ملاحظات', type:'desc' },
    ]}
    searchField="supplier_name"
  />
}
