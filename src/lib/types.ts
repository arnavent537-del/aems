export interface SessionUser {
  userId: string;
  username: string;
  name?: string;
  role: string;
  assignedClientId: string | null;
  employeeId?: string | null;
  clientId?: string | null;
}

export interface Client {
  id: string;
  name: string;
  pfApplicable: boolean;
  esicApplicable: boolean;
  ptApplicable: boolean;
  isInfinity: boolean;
  createdAt: string;
}

export interface EmployeeLocation {
  id: string;
  employeeId: string;
  locationName: string;
  latitude: string;
  longitude: string;
  inTime?: string | null;
  outTime?: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  clientId: string;
  name: string;
  dob: string;
  address: string;
  documentStatus: string;
  safetyApronIssued: boolean;
  punchingNo: string | null;
  dateOfJoining: string;
  dateOfExit: string | null;
  exitReason: string | null;
  status: string;
  gender: string | null;
  branch: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  ifscCode: string | null;
  pfNo: string | null;
  esicNo: string | null;
  uanNo: string | null;
  phoneNo: string | null;
  aadharNo: string | null;
  panNo: string | null;
  salaryRate: number;
  otRateMultiplier: number;
  assignedLocation?: string | null;
  locations?: EmployeeLocation[];
  client?: { name: string };
  isRegistered?: boolean;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  clientId: string;
  date: string;
  status: string;
  otHours: number;
  workHours?: number | null;
  inTime?: string | null;
  outTime?: string | null;
  inLocation?: string | null;
  outLocation?: string | null;
  employee?: { employeeCode: string; name: string; dateOfExit: string | null };
}

export interface AdvanceRecord {
  id: string;
  employeeId: string;
  clientId: string;
  date: string;
  amount: number;
  type: string;
  remarks: string | null;
  status: string;
  paymentDate?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  processedBy?: string | null;
  processedAt?: string | null;
  employee?: { employeeCode: string; name: string };
  signedAmount?: number;
  runningBalance?: number;
}

export interface SalaryRecord {
  id: string;
  employeeId: string;
  clientId: string;
  month: string;
  paidDays: number;
  otHours: number;
  basicSalary: number;
  otSalary: number;
  grossSalary: number;
  pfDeduction: number;
  esicDeduction: number;
  ptDeduction: number;
  advanceDeduction: number;
  otherDeductions: number;
  netPaid: number;
  paymentDate?: string | null;
  employee?: { employeeCode: string; name: string; salaryRate: number; otRateMultiplier: number };
  client?: { name: string; pfApplicable: boolean; esicApplicable: boolean; ptApplicable: boolean };
}

export interface ComplianceRecord {
  id: string;
  month: string;
  clientId: string;
  pfFilingStatus: string;
  esicFilingStatus: string;
  pfChallanUrl: string | null;
  esicChallanUrl: string | null;
  napsComplianceStatus: string;
  showCauseNoticesCount: number;
  client?: { name: string };
}

export interface AttendanceStats {
  presentToday: number;
  absentToday: number;
  presentMonth: number;
  absentMonth: number;
}

export interface ClientAdvanceSummary {
  clientId: string;
  name: string;
  outstanding: number;
}

export interface ClientSalarySummary {
  clientId: string;
  name: string;
  grossSalary: number;
  netPaid: number;
  count: number;
}

export interface SystemUser {
  id: string;
  username: string;
  role: string;
  assignedClientId: string | null;
  assignedClientIds?: string[];
  clientLinks?: { clientId: string }[];
  createdAt: string;
  assignedClient?: { name: string } | null;
}
