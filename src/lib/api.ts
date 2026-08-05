import type {
  SessionUser,
  Client,
  Employee,
  EmployeeLocation,
  AttendanceRecord,
  AdvanceRecord,
  SalaryRecord,
  ComplianceRecord,
  SystemUser,
  AttendanceStats,
  ClientAdvanceSummary,
  ClientSalarySummary,
} from "./types";

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data as T;
}

export const api = {
  async getMe(): Promise<SessionUser> {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    return parse<{ user: SessionUser }>(res).then((d) => d.user);
  },

  async login(username: string, password: string): Promise<SessionUser> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      credentials: "include",
    });
    return parse<{ user: SessionUser }>(res).then((d) => d.user);
  },

  async logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  },

  async employeeRequestOtp(phone: string): Promise<{ devOtp?: string; message?: string }> {
    const res = await fetch("/api/auth/employee/signup/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      credentials: "include",
    });
    return parse<{ devOtp?: string; message?: string }>(res);
  },

  async employeeVerifyOtp(phone: string, otp: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch("/api/auth/employee/signup/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp }),
      credentials: "include",
    });
    return parse<{ success: boolean; message?: string }>(res);
  },

  async employeePasswordResetRequestOtp(phone: string): Promise<{ devOtp?: string; message?: string }> {
    const res = await fetch("/api/auth/employee/password/request-reset-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      credentials: "include",
    });
    return parse<{ devOtp?: string; message?: string }>(res);
  },

  async employeePasswordReset(phone: string, otp: string, password: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch("/api/auth/employee/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp, password }),
      credentials: "include",
    });
    return parse<{ success: boolean; message?: string }>(res);
  },

  async employeeSetPassword(phone: string, password: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch("/api/auth/employee/signup/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
      credentials: "include",
    });
    return parse<{ success: boolean; message?: string }>(res);
  },

  async listClients(): Promise<Client[]> {
    const res = await fetch("/api/clients", { credentials: "include" });
    return parse<Client[]>(res);
  },

  async createClient(payload: Partial<Client>): Promise<Client> {
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<Client>(res);
  },

  async updateClient(id: string, payload: Partial<Client>): Promise<Client> {
    const res = await fetch(`/api/clients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<Client>(res);
  },

  async deleteClient(id: string): Promise<void> {
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE", credentials: "include" });
    return parse<void>(res);
  },

  async listEmployees(params: { clientId?: string; includeExited?: boolean } = {}): Promise<Employee[]> {
    const qs = new URLSearchParams();
    if (params.clientId) qs.set("clientId", params.clientId);
    if (params.includeExited) qs.set("includeExited", "true");
    const res = await fetch(`/api/employees?${qs.toString()}`, { credentials: "include" });
    return parse<Employee[]>(res);
  },

  async createEmployee(payload: Partial<Employee>): Promise<Employee> {
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<Employee>(res);
  },

  async updateEmployee(id: string, payload: Partial<Employee>): Promise<Employee> {
    const res = await fetch(`/api/employees/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<Employee>(res);
  },

  async deleteEmployee(id: string): Promise<void> {
    const res = await fetch(`/api/employees/${id}`, { method: "DELETE", credentials: "include" });
    return parse<void>(res);
  },

  async resetEmployeePassword(id: string, password: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/employees/${id}/reset-password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include",
    });
    return parse<{ success: boolean; message?: string }>(res);
  },

  async bulkEmployees(file: File): Promise<{ created: number; codes: string[]; errors: string[] }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/employees/bulk", {
      method: "POST",
      body: form,
      credentials: "include",
    });
    return parse<{ created: number; codes: string[]; errors: string[] }>(res);
  },

  async bulkAdvances(clientId: string, file: File): Promise<{ created: number; codes: string[]; errors: string[] }> {
    const form = new FormData();
    form.append("clientId", clientId);
    form.append("file", file);
    const res = await fetch("/api/advances/bulk", {
      method: "POST",
      body: form,
      credentials: "include",
    });
    return parse<{ created: number; codes: string[]; errors: string[] }>(res);
  },

  async getEmployeeLocations(employeeId: string): Promise<EmployeeLocation[]> {
    const res = await fetch(`/api/employees/${employeeId}/locations`, { credentials: "include" });
    return parse<EmployeeLocation[]>(res);
  },

  async createEmployeeLocation(employeeId: string, location: Partial<EmployeeLocation>): Promise<EmployeeLocation> {
    const res = await fetch(`/api/employees/${employeeId}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(location),
      credentials: "include",
    });
    return parse<EmployeeLocation>(res);
  },

  async updateEmployeeLocations(employeeId: string, locations: Partial<EmployeeLocation>[]): Promise<EmployeeLocation[]> {
    const res = await fetch(`/api/employees/${employeeId}/locations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations }),
      credentials: "include",
    });
    return parse<EmployeeLocation[]>(res);
  },

  async deleteEmployeeLocation(employeeId: string, locationId: string): Promise<void> {
    const res = await fetch(`/api/employees/${employeeId}/locations?locationId=${locationId}`, {
      method: "DELETE",
      credentials: "include",
    });
    return parse<void>(res);
  },

  async listAttendance(params: { clientId?: string; employeeId?: string; date?: string; month?: string }): Promise<AttendanceRecord[]> {
    const qs = new URLSearchParams();
    if (params.clientId) qs.set("clientId", params.clientId);
    if (params.employeeId) qs.set("employeeId", params.employeeId);
    if (params.date) qs.set("date", params.date);
    if (params.month) qs.set("month", params.month);
    const res = await fetch(`/api/attendance?${qs.toString()}`, { credentials: "include" });
    return parse<AttendanceRecord[]>(res);
  },

  async myEmployee(): Promise<Employee> {
    const res = await fetch("/api/employees/me", { credentials: "include" });
    return parse<Employee>(res);
  },

  async saveAttendance(clientId: string, records: any[]): Promise<void> {
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, records }),
      credentials: "include",
    });
    return parse<void>(res);
  },

  async updateAttendanceTime(id: string, payload: { inTime?: string | null; outTime?: string | null }): Promise<{ success: boolean; inTime?: string | null; outTime?: string | null; workHours?: number | null }> {
    const res = await fetch(`/api/attendance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<{ success: boolean; inTime?: string | null; outTime?: string | null; workHours?: number | null }>(res);
  },

  async attendanceStats(clientId: string, month: string): Promise<AttendanceStats> {
    const qs = new URLSearchParams({ clientId, month });
    const res = await fetch(`/api/attendance/stats?${qs.toString()}`, { credentials: "include" });
    return parse<AttendanceStats>(res);
  },

  async listAdvances(params: { employeeId?: string; clientId?: string; status?: string }): Promise<AdvanceRecord[]> {
    const qs = new URLSearchParams();
    if (params.employeeId) qs.set("employeeId", params.employeeId);
    if (params.clientId) qs.set("clientId", params.clientId);
    if (params.status) qs.set("status", params.status);
    const res = await fetch(`/api/advances?${qs.toString()}`, { credentials: "include" });
    return parse<AdvanceRecord[]>(res);
  },

  async createAdvance(payload: Partial<AdvanceRecord>): Promise<AdvanceRecord> {
    const res = await fetch("/api/advances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<AdvanceRecord>(res);
  },

  async updateAdvance(id: string, payload: Partial<AdvanceRecord>): Promise<AdvanceRecord> {
    const res = await fetch(`/api/advances/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<AdvanceRecord>(res);
  },

  async deleteAdvance(id: string): Promise<void> {
    const res = await fetch(`/api/advances/${id}`, { method: "DELETE", credentials: "include" });
    return parse<void>(res);
  },

  async updateAdvanceStatus(id: string, status: string): Promise<AdvanceRecord> {
    const res = await fetch(`/api/advances/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      credentials: "include",
    });
    return parse<AdvanceRecord>(res);
  },

  async advanceSummary(): Promise<ClientAdvanceSummary[]> {
    const res = await fetch(`/api/advances/summary`, { credentials: "include" });
    return parse<ClientAdvanceSummary[]>(res);
  },

  async listSalaries(clientId: string, month?: string, employeeId?: string): Promise<SalaryRecord[]> {
    const qs = new URLSearchParams();
    qs.set("clientId", clientId);
    if (month) qs.set("month", month);
    if (employeeId) qs.set("employeeId", employeeId);
    const res = await fetch(`/api/salaries?${qs.toString()}`, { credentials: "include" });
    return parse<SalaryRecord[]>(res);
  },

  async saveSalary(payload: any): Promise<SalaryRecord> {
    const res = await fetch("/api/salaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<SalaryRecord>(res);
  },

  async updateSalary(id: string, payload: any): Promise<SalaryRecord> {
    const res = await fetch(`/api/salaries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<SalaryRecord>(res);
  },

  async deleteSalary(id: string): Promise<void> {
    const res = await fetch(`/api/salaries/${id}`, { method: "DELETE", credentials: "include" });
    return parse<void>(res);
  },

  async salarySummary(month?: string): Promise<ClientSalarySummary[]> {
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    const res = await fetch(`/api/salaries/summary?${qs.toString()}`, { credentials: "include" });
    return parse<ClientSalarySummary[]>(res);
  },

  async listCompliance(params: { clientId?: string; month?: string } = {}): Promise<ComplianceRecord[]> {
    const qs = new URLSearchParams();
    if (params.clientId) qs.set("clientId", params.clientId);
    if (params.month) qs.set("month", params.month);
    const res = await fetch(`/api/compliance?${qs.toString()}`, { credentials: "include" });
    return parse<ComplianceRecord[]>(res);
  },

  async createCompliance(payload: { clientId: string; month: string }): Promise<ComplianceRecord> {
    const res = await fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<ComplianceRecord>(res);
  },

  async updateCompliance(id: string, payload: any): Promise<ComplianceRecord> {
    const res = await fetch(`/api/compliance/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<ComplianceRecord>(res);
  },

  async deleteCompliance(id: string): Promise<void> {
    const res = await fetch(`/api/compliance/${id}`, { method: "DELETE", credentials: "include" });
    return parse<void>(res);
  },

  async listUsers(): Promise<SystemUser[]> {
    const res = await fetch("/api/users", { credentials: "include" });
    return parse<SystemUser[]>(res);
  },

  async createUser(payload: { username: string; password: string; role: string; assignedClientId?: string | null; assignedClientIds?: string[] }): Promise<SystemUser> {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<SystemUser>(res);
  },

  async updateUser(id: string, payload: any): Promise<SystemUser> {
    const res = await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return parse<SystemUser>(res);
  },

  async deleteUser(id: string): Promise<void> {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE", credentials: "include" });
    return parse<void>(res);
  },
};
