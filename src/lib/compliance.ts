export const WORKFLOW_STATUSES = ["Pending", "In Process", "Completed"] as const;
export const PAID_STATUSES = ["Unpaid", "Paid"] as const;
export const CHALLAN_UPLOAD_STATUSES = [...WORKFLOW_STATUSES, "Not Required"] as const;
export const CHALLAN_PAID_STATUSES = [...PAID_STATUSES, "Not Required"] as const;

export type ComplianceStatus = string;

export interface ComplianceField {
  key: string;
  label: string;
  group: "Workflow" | "Challan Upload" | "Challan Paid";
  statuses: readonly string[];
}

export const COMPLIANCE_FIELDS: ComplianceField[] = [
  { key: "finalAttendanceStatus", label: "Final Attendance", group: "Workflow", statuses: WORKFLOW_STATUSES },
  { key: "finalBillStatus", label: "Final Bill", group: "Workflow", statuses: WORKFLOW_STATUSES },
  { key: "advancesStatus", label: "Advances", group: "Workflow", statuses: WORKFLOW_STATUSES },
  { key: "salaryExcelSheetStatus", label: "Salary Excel Sheet", group: "Workflow", statuses: WORKFLOW_STATUSES },
  { key: "salaryUploadToPortalStatus", label: "Salary Upload to Portal", group: "Workflow", statuses: WORKFLOW_STATUSES },
  { key: "salaryDisburseStatus", label: "Salary Disburse", group: "Workflow", statuses: WORKFLOW_STATUSES },
  { key: "pfChallanEcrUploadStatus", label: "PF Challan ECR Upload", group: "Challan Upload", statuses: CHALLAN_UPLOAD_STATUSES },
  { key: "esicChallanEcrUploadStatus", label: "ESIC Challan ECR Upload", group: "Challan Upload", statuses: CHALLAN_UPLOAD_STATUSES },
  { key: "ptChallanUploadStatus", label: "PT Challan Upload", group: "Challan Upload", statuses: CHALLAN_UPLOAD_STATUSES },
  { key: "gstChallanUploadStatus", label: "GST Challan Upload", group: "Challan Upload", statuses: CHALLAN_UPLOAD_STATUSES },
  { key: "pfChallanPaidStatus", label: "PF Challan Paid", group: "Challan Paid", statuses: CHALLAN_PAID_STATUSES },
  { key: "esicChallanPaidStatus", label: "ESIC Challan Paid", group: "Challan Paid", statuses: CHALLAN_PAID_STATUSES },
  { key: "ptPaidStatus", label: "PT Paid", group: "Challan Paid", statuses: CHALLAN_PAID_STATUSES },
  { key: "gstPaidStatus", label: "GST Paid", group: "Challan Paid", statuses: CHALLAN_PAID_STATUSES },
];

export const COMPLIANCE_STATUS_KEYS = COMPLIANCE_FIELDS.map((f) => f.key);

export function statusColor(value: string): "green" | "blue" | "amber" | "slate" {
  if (value === "Completed" || value === "Paid") return "green";
  if (value === "In Process") return "blue";
  if (value === "Not Required") return "slate";
  return "amber";
}

export function complianceProgress(record: object): { done: number; total: number } {
  const r = record as Record<string, unknown>;
  let done = 0;
  for (const f of COMPLIANCE_FIELDS) {
    const value = r[f.key];
    if (value === "Completed" || value === "Paid" || value === "Not Required") done += 1;
  }
  return { done, total: COMPLIANCE_FIELDS.length };
}

export function defaultComplianceStatuses(): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const f of COMPLIANCE_FIELDS) defaults[f.key] = f.statuses[0];
  return defaults;
}
