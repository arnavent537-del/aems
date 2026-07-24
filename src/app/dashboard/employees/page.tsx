"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, Badge, Button, Modal, Field, inputClass, Toast } from "@/components/ui";
import type { Client, Employee } from "@/lib/types";
import { Plus, Pencil, Trash2, LogOut, UserCheck, Search, Upload, KeyRound, Download } from "lucide-react";

const DOC_STATUSES = ["Pending", "Submitted", "Verified"];

export default function EmployeesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clientFilter, setClientFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [docStatusFilter, setDocStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("admin");
  const [staffEmployeeId, setStaffEmployeeId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" }>({ msg: "", type: "error" });

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwEmployee, setResetPwEmployee] = useState<Employee | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [resettingPw, setResettingPw] = useState(false);

  const canEdit = role === "admin" || role === "accountant";
  const isArnavRestrictedView = role !== "admin" && staffEmployeeId !== null &&
    clients.find(c => c.id === clientFilter)?.name === "Arnav Enterprises";

  const loadClients = useCallback(async () => {
    const cl = await api.listClients();
    setClients(cl);
    return cl;
  }, []);

  const loadEmployees = useCallback(async () => {
    const emp = await api.listEmployees({ clientId: clientFilter || undefined, includeExited: true });
    setEmployees(emp);
  }, [clientFilter]);

  useEffect(() => {
    api
      .getMe()
      .then((u) => { setRole(u.role); setStaffEmployeeId(u.employeeId || null); })
      .catch(() => {});
    loadClients().then((cl) => {
      if (cl.length) setClientFilter(cl[0].id);
    });
  }, [loadClients]);

  useEffect(() => {
    if (!clientFilter) return;
    setLoading(true);
    loadEmployees().finally(() => setLoading(false));
  }, [clientFilter, loadEmployees]);

  function openAdd() {
    setEditing(null);
    setForm({
      clientId: clientFilter,
      documentStatus: "Pending",
      safetyApronIssued: false,
      uniform: "No",
      otRateMultiplier: 2,
      salaryRate: 0,
    });
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({ ...emp });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      let empId: string | undefined;
      if (editing) {
        await api.updateEmployee(editing.id, form);
        empId = editing.id;
        setToast({ msg: "Employee updated", type: "success" });
      } else {
        const created = await api.createEmployee(form);
        empId = created.id;
        setToast({ msg: "Employee created", type: "success" });
      }

      // Save location separately for Arnav Enterprises employees
      if (empId && form.assignedLocation) {
        const client = clients.find((c) => c.id === form.clientId);
        if (client?.name === "Arnav Enterprises") {
          try {
            await fetch("/api/employees/location", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ employeeId: empId, location: form.assignedLocation }),
              credentials: "include",
            });
          } catch {
            // Location save is secondary; don't block the main save
          }
        }
      }

      setModalOpen(false);
      await loadEmployees();
    } catch (e: any) {
      setToast({ msg: e.message || "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(emp: Employee) {
    if (!confirm(`Delete employee ${emp.name}? This removes all related records.`)) return;
    try {
      await api.deleteEmployee(emp.id);
      setToast({ msg: "Employee deleted", type: "success" });
      await loadEmployees();
    } catch (e: any) {
      setToast({ msg: e.message || "Delete failed", type: "error" });
    }
  }

  async function toggleExit(emp: Employee) {
    const exiting = !emp.dateOfExit;
    const date = exiting ? prompt("Enter exit date (DD-MM-YYYY):", new Date().toLocaleDateString("en-GB")) : "";
    if (exiting && !date) return;
    try {
      await api.updateEmployee(emp.id, { dateOfExit: exiting ? date : null });
      setToast({ msg: exiting ? "Employee marked as exited" : "Employee reactivated", type: "success" });
      await loadEmployees();
    } catch (e: any) {
      setToast({ msg: e.message || "Update failed", type: "error" });
    }
  }

  async function handleImport() {
    if (!importFile) {
      setToast({ msg: "Choose an Excel/CSV file first", type: "error" });
      return;
    }
    setImporting(true);
    try {
      const res = await api.bulkEmployees(importFile);
      const errPart = res.errors && res.errors.length ? ` (${res.errors.length} skipped)` : "";
      setToast({ msg: `Imported ${res.created} employee(s)${errPart}`, type: "success" });
      setImportOpen(false);
      setImportFile(null);
      await loadEmployees();
    } catch (e: any) {
      setToast({ msg: e.message || "Import failed", type: "error" });
    } finally {
      setImporting(false);
    }
  }

  function toDateInput(dateStr: string): string {
    if (!dateStr) return "";
    // Try DD-MM-YYYY → convert to YYYY-MM-DD
    let m = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    // Try YYYY-MM-DD → already correct for <input type="date">
    m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return dateStr;
    // Try DD/MM/YYYY → convert to YYYY-MM-DD
    m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    // Try YYYY/MM/DD → convert to YYYY-MM-DD
    m = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return "";
  }

  function fromDateInput(yyyyMmDd: string): string {
    if (!yyyyMmDd) return "";
    const m = yyyyMmDd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  }

  function openResetPw(emp: Employee) {
    setResetPwEmployee(emp);
    setResetPwValue("");
    setResetPwOpen(true);
  }

  async function handleResetPw() {
    if (!resetPwEmployee || resetPwValue.length < 6) {
      setToast({ msg: "Password must be at least 6 characters", type: "error" });
      return;
    }
    setResettingPw(true);
    try {
      await api.resetEmployeePassword(resetPwEmployee.id, resetPwValue);
      setToast({ msg: "Password reset successfully", type: "success" });
      setResetPwOpen(false);
      setResetPwEmployee(null);
      setResetPwValue("");
    } catch (e: any) {
      setToast({ msg: e.message || "Reset failed", type: "error" });
    } finally {
      setResettingPw(false);
    }
  }

  function handleExport() {
    window.location.href = `/api/employees/export?clientId=${clientFilter}`;
  }

  const filtered = employees.filter(
    (e) => {
      // Search filter
      if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.employeeCode.toLowerCase().includes(search.toLowerCase())) return false;
      // Status filter
      if (statusFilter === "active" && e.dateOfExit) return false;
      if (statusFilter === "inactive" && !e.dateOfExit) return false;
      // Document status filter
      if (docStatusFilter !== "all" && e.documentStatus !== docStatusFilter) return false;
      return true;
    }
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employees</h1>
          <p className="text-sm text-slate-500">Manage employee master records by client.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {!isArnavRestrictedView && (
              <>
                <Button variant="secondary" onClick={() => window.open("/employee_upload_template.xlsx", "_blank")}>
                  <Upload className="h-4 w-4" /> Download Template
                </Button>
                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4" /> Import Excel
                </Button>
                <Button variant="secondary" onClick={handleExport}>
                  <Download className="h-4 w-4" /> Download Employees
                </Button>
                <Button onClick={openAdd}>
                  <Plus className="h-4 w-4" /> Add Employee
                </Button>
              </>
            )}
            {isArnavRestrictedView && (
              <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Viewing your personal data only
              </span>
            )}
          </div>
        )}
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Client</label>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className={inputClass}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
            className={inputClass}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Doc. Status</label>
          <select
            value={docStatusFilter}
            onChange={(e) => setDocStatusFilter(e.target.value)}
            className={inputClass}
          >
            <option value="all">All</option>
            {DOC_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="relative min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Search</label>
          <div className="flex items-center rounded-lg border border-slate-300 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or code"
              className="w-full bg-transparent px-2 py-2 text-sm outline-none"
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">DOJ</th>
              <th className="px-4 py-3">Documents</th>
              <th className="px-4 py-3">Uniform</th>
              <th className="px-4 py-3">Salary Rate</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Account</th>
              {canEdit && !isArnavRestrictedView && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
              {loading && (
              <tr>
                <td colSpan={canEdit ? 10 : 9} className="px-4 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 10 : 9} className="px-4 py-6 text-center text-slate-400">
                  No employees found.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.employeeCode}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{e.name}</td>
                  <td className="px-4 py-3 text-slate-600">{e.client?.name}</td>
                  <td className="px-4 py-3 text-slate-600">{e.dateOfJoining}</td>
                  <td className="px-4 py-3">
                    <Badge
                      color={
                        e.documentStatus === "Verified" ? "green" : e.documentStatus === "Submitted" ? "blue" : "amber"
                      }
                    >
                      {e.documentStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {e.safetyApronIssued ? (
                      <Badge color="blue">Yes</Badge>
                    ) : (
                      <Badge color="slate">No</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">₹{e.salaryRate}</td>
                  <td className="px-4 py-3">
                    {e.dateOfExit ? (
                      <Badge color="red">Exited {e.dateOfExit}</Badge>
                    ) : (
                      <Badge color="green">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.isRegistered ? (
                      <Badge color="blue">Registered</Badge>
                    ) : (
                      <Badge color="slate">Not Registered</Badge>
                    )}
                  </td>
                  {canEdit && !isArnavRestrictedView && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(e)}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleExit(e)}
                          className="rounded p-1.5 text-amber-600 hover:bg-amber-50"
                          title={e.dateOfExit ? "Reactivate" : "Mark exited"}
                        >
                          {e.dateOfExit ? <UserCheck className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => openResetPw(e)}
                          className="rounded p-1.5 text-purple-600 hover:bg-purple-50"
                          title="Reset Password"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(e)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? "Edit Employee" : "Add Employee"}
        onClose={() => setModalOpen(false)}
        width="max-w-3xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client">
            <select
              className={inputClass}
              value={form.clientId || ""}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name">
            <input className={inputClass} value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Gender">
            <select className={inputClass} value={form.gender || ""} onChange={(e) => setForm({ ...form, gender: e.target.value || null })}>
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </Field>
          <Field label="Date of Birth">
            <input type="date" className={inputClass} value={toDateInput(form.dob)} onChange={(e) => setForm({ ...form, dob: fromDateInput(e.target.value) })} />
          </Field>
          <Field label="Date of Joining">
            <input type="date" className={inputClass} value={toDateInput(form.dateOfJoining)} onChange={(e) => setForm({ ...form, dateOfJoining: fromDateInput(e.target.value) })} />
          </Field>
          <Field label="Address">
            <input className={inputClass} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Phone No">
            <input className={inputClass} value={form.phoneNo || ""} onChange={(e) => setForm({ ...form, phoneNo: e.target.value })} />
          </Field>
          <Field label="Salary Rate (daily/monthly)">
            <input type="number" className={inputClass} value={form.salaryRate ?? 0} onChange={(e) => setForm({ ...form, salaryRate: e.target.value })} />
          </Field>
          <Field label="OT Rate Multiplier">
            <input type="number" step="0.1" className={inputClass} value={form.otRateMultiplier ?? 2} onChange={(e) => setForm({ ...form, otRateMultiplier: e.target.value })} />
          </Field>
          <Field label="Document Status">
            <select className={inputClass} value={form.documentStatus || "Pending"} onChange={(e) => setForm({ ...form, documentStatus: e.target.value })}>
              {DOC_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          {clients.find((c) => c.id === form.clientId)?.isInfinity && (
            <Field label="Punching No">
              <input className={inputClass} value={form.punchingNo || ""} onChange={(e) => setForm({ ...form, punchingNo: e.target.value })} />
            </Field>
          )}
          <Field label="Bank Name">
            <input className={inputClass} value={form.bankName || ""} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
          </Field>
          <Field label="Bank Account No">
            <input className={inputClass} value={form.bankAccountNo || ""} onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })} />
          </Field>
          <Field label="IFSC Code">
            <input className={inputClass} value={form.ifscCode || ""} onChange={(e) => setForm({ ...form, ifscCode: e.target.value })} />
          </Field>
          <Field label="Branch">
            <input className={inputClass} value={form.branch || ""} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
          </Field>
          <Field label="ESIC No">
            <input className={inputClass} value={form.esicNo || ""} onChange={(e) => setForm({ ...form, esicNo: e.target.value })} />
          </Field>
          <Field label="UAN No">
            <input className={inputClass} value={form.uanNo || ""} onChange={(e) => setForm({ ...form, uanNo: e.target.value })} />
          </Field>
          <Field label="Aadhar No">
            <input className={inputClass} value={form.aadharNo || ""} onChange={(e) => setForm({ ...form, aadharNo: e.target.value })} />
          </Field>
          <Field label="PAN No">
            <input className={inputClass} value={form.panNo || ""} onChange={(e) => setForm({ ...form, panNo: e.target.value })} />
          </Field>
          <div className="col-span-1 sm:col-span-2 border-t border-slate-200 pt-4 mt-2">
            <p className="text-sm font-medium text-slate-600 mb-3">Exit Details</p>
          </div>
          <Field label="Date of Exit">
            <input type="date" className={inputClass} value={toDateInput(form.dateOfExit)} onChange={(e) => setForm({ ...form, dateOfExit: fromDateInput(e.target.value) })} />
          </Field>
          <Field label="Exit Reason">
            <input className={inputClass} value={form.exitReason || ""} onChange={(e) => setForm({ ...form, exitReason: e.target.value })} />
          </Field>
          {clients.find((c) => c.id === form.clientId)?.name === "Arnav Enterprises" && (
            <div className="col-span-1 sm:col-span-2 border-t border-slate-200 pt-4 mt-2">
              <p className="text-sm font-medium text-slate-600 mb-3">Work Location (Arnav Enterprises)</p>
              <Field label="Assigned Location (lat,lng)">
                <input
                  className={inputClass}
                  placeholder="e.g. 18.5204,73.8567"
                  value={form.assignedLocation || ""}
                  onChange={(e) => setForm({ ...form, assignedLocation: e.target.value })}
                />
              </Field>
              <p className="mt-1 text-xs text-slate-400">
                Employee must be within 100 meters of this location to check in/out. Get coordinates from Google Maps.
              </p>
            </div>
          )}
          <Field label="Uniform">
            <select
              className={inputClass}
              value={form.safetyApronIssued ? (form.uniform || "Yes") : "No"}
              onChange={(e) => setForm({ ...form, safetyApronIssued: e.target.value !== "No", uniform: e.target.value === "No" ? "No" : e.target.value })}
            >
              <option value="No">No</option>
              <option value="Full Uniform">Full Uniform</option>
              <option value="Apron">Apron</option>
              <option value="Shoes">Shoes</option>
            </select>
          </Field>
        </div>
      </Modal>

      <Toast message={toast.msg} type={toast.type} />

      <Modal
        open={importOpen}
        title="Bulk Import Employees"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : "Upload & Provision"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Upload an <span className="font-medium">.xlsx</span> or <span className="font-medium">.csv</span> file with columns:
            <span className="mt-1 block font-mono text-xs text-slate-600">
              Client, EmployeeCode, Name, Gender, DOB, DateOfJoining, MobileNo, Address, SalaryRate, OTRate, Aadhar_No, PAN_No, BankAccountNo, IFSC_Code, BankName, Branch, ESIC_No, UAN_No, Unifrom, DocumentStatus, DateofExit, ExitReason
            </span>
          </p>
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
            <strong>Required:</strong> Client, Name, DateOfJoining, SalaryRate
            <br />
            <strong>Optional:</strong> All other columns
            <br />
            <a
              href="/employee_upload_template.xlsx"
              download
              className="mt-2 inline-block font-medium underline hover:text-blue-900"
            >
              Download sample template →
            </a>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
      </Modal>

      <Modal
        open={resetPwOpen}
        title={`Reset Password - ${resetPwEmployee?.name || ""}`}
        onClose={() => setResetPwOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetPwOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPw} disabled={resettingPw}>
              {resettingPw ? "Resetting..." : "Reset Password"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Set a new password for <span className="font-medium">{resetPwEmployee?.name}</span>.
          </p>
          <Field label="New Password (min 6 chars)">
            <input
              type="password"
              className={inputClass}
              value={resetPwValue}
              onChange={(e) => setResetPwValue(e.target.value)}
              placeholder="Enter new password"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
