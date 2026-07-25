"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, Badge, Button, Modal, Field, inputClass, Toast } from "@/components/ui";
import type { Client, Employee, SalaryRecord, ClientSalarySummary } from "@/lib/types";
import { computePayroll } from "@/lib/payroll";
import { Plus, Pencil, Trash2, Download, BarChart3, Upload } from "lucide-react";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function SalaryPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [client, setClient] = useState<Client | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [summary, setSummary] = useState<ClientSalarySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("admin");
  const [myEmployeeId, setMyEmployeeId] = useState<string>("");
  const [staffEmployeeId, setStaffEmployeeId] = useState<string | null>(null);

  const isEmployee = role === "employee";

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryRecord | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" }>({ msg: "", type: "error" });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const canEdit = role === "admin" || role === "accountant";
  // Check if viewing Arnav as non-admin staff (read-only view)
  const isArnavRestrictedView = role !== "admin" && role !== "employee" && staffEmployeeId !== null &&
    client?.name === "Arnav Enterprises";

  const loadClients = useCallback(async () => {
    const cl = await api.listClients();
    setClients(cl);
    return cl;
  }, []);

  useEffect(() => {
    api
      .getMe()
      .then(async (u) => {
        setRole(u.role);
        setStaffEmployeeId(u.employeeId || null);
        if (u.role === "employee" && u.employeeId) {
          try {
            const me = await api.myEmployee();
            setClientId(me.clientId || "");
            setMyEmployeeId(me.id);
            setClient({
              id: me.clientId || "",
              name: me.client?.name || "",
              pfApplicable: true,
              esicApplicable: true,
              ptApplicable: true,
              isInfinity: false,
              createdAt: "",
            });
          } catch {
            /* ignore */
          }
          return;
        }
        const cl = await loadClients();
        if (cl.length) setClientId(cl[0].id);
      })
      .catch(() => {});
  }, [loadClients]);

  useEffect(() => {
    if (!clientId || isEmployee) return;
    const c = clients.find((x) => x.id === clientId) || null;
    setClient(c);
    api.listEmployees({ clientId }).then(setEmployees);
  }, [clientId, clients, isEmployee]);

  const loadSalaries = useCallback(async () => {
    if (!clientId && !isEmployee) return;
    setLoading(true);
    try {
      const data = await api.listSalaries(clientId, month, isEmployee ? myEmployeeId : undefined);
      setSalaries(data);
    } finally {
      setLoading(false);
    }
  }, [clientId, month, isEmployee, myEmployeeId]);

  useEffect(() => {
    loadSalaries();
  }, [loadSalaries]);

  useEffect(() => {
    if (isEmployee) return;
    api.salarySummary(month).then(setSummary).catch(() => setSummary([]));
  }, [month, isEmployee]);

  function openAdd() {
    setEditing(null);
    setForm({
      employeeId: employees[0]?.id || "",
      month,
      paidDays: 30,
      otHours: 0,
      basicSalary: employees[0]?.salaryRate || 0,
      otSalary: 0,
      advanceDeduction: 0,
      otherDeductions: 0,
    });
    setModalOpen(true);
  }

  function openEdit(s: SalaryRecord) {
    setEditing(s);
    setForm({
      employeeId: s.employeeId,
      month: s.month,
      paidDays: s.paidDays,
      otHours: s.otHours,
      basicSalary: s.basicSalary,
      otSalary: s.otSalary,
      advanceDeduction: s.advanceDeduction,
      otherDeductions: s.otherDeductions,
    });
    setModalOpen(true);
  }

  const preview = client
    ? computePayroll(
        {
          basicSalary: parseFloat(form.basicSalary) || 0,
          otSalary: parseFloat(form.otSalary) || 0,
          clientRules: client,
        },
        parseFloat(form.advanceDeduction) || 0,
        parseFloat(form.otherDeductions) || 0
      )
    : null;

  async function save() {
    setSaving(true);
    try {
      const payload = {
        employeeId: form.employeeId,
        clientId,
        month: form.month,
        paidDays: form.paidDays,
        otHours: form.otHours,
        basicSalary: form.basicSalary,
        otSalary: form.otSalary,
        advanceDeduction: form.advanceDeduction,
        otherDeductions: form.otherDeductions,
      };
      if (editing) {
        await api.updateSalary(editing.id, payload);
        setToast({ msg: "Salary updated", type: "success" });
      } else {
        await api.saveSalary(payload);
        setToast({ msg: "Salary recorded", type: "success" });
      }
      setModalOpen(false);
      await loadSalaries();
    } catch (e: any) {
      setToast({ msg: e.message || "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: SalaryRecord) {
    if (!confirm("Delete this salary record?")) return;
    try {
      await api.deleteSalary(s.id);
      setToast({ msg: "Salary deleted", type: "success" });
      await loadSalaries();
    } catch (e: any) {
      setToast({ msg: e.message || "Delete failed", type: "error" });
    }
  }

  function exportExcel() {
    window.location.href = `/api/salaries/export?clientId=${clientId}&month=${month}`;
  }

  async function handleSalaryUpload() {
    if (!uploadFile) {
      setToast({ msg: "Choose an Excel/CSV file first", type: "error" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("clientId", clientId);

      const response = await fetch("/api/salaries/bulk", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const res = await response.json();
      const errPart = res.errors && res.errors.length ? ` (${res.errors.length} skipped)` : "";
      setToast({ msg: `Imported ${res.created} salary record(s)${errPart}`, type: "success" });
      setUploadOpen(false);
      setUploadFile(null);
      await loadSalaries();
    } catch (e: any) {
      setToast({ msg: e.message || "Upload failed", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  const cols = [
    "Employee",
    "Paid Days",
    "OT Hrs",
    "Basic",
    "OT Sal",
    "Gross",
    client?.pfApplicable && "PF",
    client?.esicApplicable && "ESIC",
    client?.ptApplicable && "PT",
    "Adv Ded",
    "Other Ded",
    "Net Paid",
    "Payment Date",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Salary / Payroll</h1>
          <p className="text-sm text-slate-500">
            Client-specific columns are applied based on PF / ESIC / PT applicability.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportExcel}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          {isArnavRestrictedView && (
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Viewing your personal data only
            </span>
          )}
          {canEdit && !isArnavRestrictedView && (
            <>
              <Button variant="secondary" onClick={() => window.open("/salary_upload_template.xlsx", "_blank")}>
                <Download className="h-4 w-4" /> Template
              </Button>
              <Button variant="secondary" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4" /> Upload Excel
              </Button>
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add Salary
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        {!isEmployee && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Client</label>
            <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Month</label>
          <input type="month" className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        {client && (
          <div className="flex flex-wrap gap-1.5 pb-1">
            <Badge color={client.pfApplicable ? "green" : "slate"}>PF {client.pfApplicable ? "On" : "Off"}</Badge>
            <Badge color={client.esicApplicable ? "green" : "slate"}>ESIC {client.esicApplicable ? "On" : "Off"}</Badge>
            <Badge color={client.ptApplicable ? "green" : "slate"}>PT {client.ptApplicable ? "On" : "Off"}</Badge>
          </div>
        )}
      </Card>

      {!isEmployee && summary.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-slate-800">Gross Salary Liability by Client — {month}</h2>
          </div>
          <div className="space-y-3">
            {summary.map((c) => {
              const max = Math.max(...summary.map((s) => s.grossSalary), 1);
              const pct = (c.grossSalary / max) * 100;
              return (
                <div key={c.clientId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{c.name}</span>
                    <span className="font-semibold text-purple-700">
                      ₹{c.grossSalary.toLocaleString("en-IN", { maximumFractionDigits: 0 })} · {c.count} emp
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              {cols.map((c) => (
                <th key={c} className="px-4 py-3">
                  {c}
                </th>
              ))}
              {canEdit && !isArnavRestrictedView && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={cols.length + (canEdit ? 1 : 0)} className="px-4 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && salaries.length === 0 && (
              <tr>
                <td colSpan={cols.length + (canEdit ? 1 : 0)} className="px-4 py-6 text-center text-slate-400">
                  No salary records for this month.
                </td>
              </tr>
            )}
            {!loading &&
              salaries.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <span className="font-mono text-xs text-slate-400">{s.employee?.employeeCode}</span>
                    <br />
                    {s.employee?.name}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{s.paidDays}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{s.otHours}</td>
                  <td className="px-4 py-3 text-right text-slate-600">₹{s.basicSalary}</td>
                  <td className="px-4 py-3 text-right text-slate-600">₹{s.otSalary}</td>
                  <td className="px-4 py-3 text-right text-slate-600">₹{s.grossSalary}</td>
                  {client?.pfApplicable && <td className="px-4 py-3 text-right text-slate-600">₹{s.pfDeduction}</td>}
                  {client?.esicApplicable && <td className="px-4 py-3 text-right text-slate-600">₹{s.esicDeduction}</td>}
                  {client?.ptApplicable && <td className="px-4 py-3 text-right text-slate-600">₹{s.ptDeduction}</td>}
                  <td className="px-4 py-3 text-right text-slate-600">₹{s.advanceDeduction}</td>
                  <td className="px-4 py-3 text-right text-slate-600">₹{s.otherDeductions}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">₹{s.netPaid}</td>
                  <td className="px-4 py-3 text-slate-600">{s.paymentDate || "—"}</td>
                  {canEdit && !isArnavRestrictedView && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(s)} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Delete">
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
        title={editing ? "Edit Salary" : "Add Salary"}
        onClose={() => setModalOpen(false)}
        width="max-w-2xl"
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
        {client && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Employee">
                <select className={inputClass} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} disabled={!!editing}>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.employeeCode} — {e.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Month">
                <input type="month" className={inputClass} value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} disabled={!!editing} />
              </Field>
              <Field label="Paid Days">
                <input type="number" className={inputClass} value={form.paidDays} onChange={(e) => setForm({ ...form, paidDays: e.target.value })} />
              </Field>
              <Field label="OT Hours">
                <input type="number" step="0.5" className={inputClass} value={form.otHours} onChange={(e) => setForm({ ...form, otHours: e.target.value })} />
              </Field>
              <Field label="Basic Salary (₹)">
                <input type="number" className={inputClass} value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} />
              </Field>
              <Field label="OT Salary (₹)">
                <input type="number" className={inputClass} value={form.otSalary} onChange={(e) => setForm({ ...form, otSalary: e.target.value })} />
              </Field>
              <Field label="Advance Deduction (₹)">
                <input type="number" className={inputClass} value={form.advanceDeduction} onChange={(e) => setForm({ ...form, advanceDeduction: e.target.value })} />
              </Field>
              <Field label="Other Deductions (₹)">
                <input type="number" className={inputClass} value={form.otherDeductions} onChange={(e) => setForm({ ...form, otherDeductions: e.target.value })} />
              </Field>
            </div>

            {preview && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-700">Calculation Preview</p>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  <span className="text-slate-500">Gross</span>
                  <span className="text-right font-medium">₹{preview.grossSalary}</span>
                  {client.pfApplicable && (
                    <>
                      <span className="text-slate-500">PF</span>
                      <span className="text-right font-medium text-red-600">-₹{preview.pfDeduction}</span>
                    </>
                  )}
                  {client.esicApplicable && (
                    <>
                      <span className="text-slate-500">ESIC</span>
                      <span className="text-right font-medium text-red-600">-₹{preview.esicDeduction}</span>
                    </>
                  )}
                  {client.ptApplicable && (
                    <>
                      <span className="text-slate-500">PT</span>
                      <span className="text-right font-medium text-red-600">-₹{preview.ptDeduction}</span>
                    </>
                  )}
                  <span className="text-slate-500">Adv+Other</span>
                  <span className="text-right font-medium text-red-600">
                    -₹{preview.advanceDeduction + preview.otherDeductions}
                  </span>
                  <span className="text-slate-700">Net Paid</span>
                  <span className="text-right font-bold text-emerald-700">₹{preview.netPaid}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Toast message={toast.msg} type={toast.type} />

      <Modal
        open={uploadOpen}
        title="Bulk Upload Salary Records"
        onClose={() => setUploadOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSalaryUpload} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload & Process"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Upload an <span className="font-medium">.xlsx</span> or <span className="font-medium">.csv</span> file with columns:
            <span className="mt-1 block font-mono text-xs text-slate-600">
              EmployeeCode, Month, PaidDays, OTHours, BasicSalary, OTSalary, AdvanceDeduction, OtherDeductions
            </span>
          </p>
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
            <strong>Required:</strong> EmployeeCode, Month, PaidDays, BasicSalary
            <br />
            <strong>Optional:</strong> OTHours, OTSalary, AdvanceDeduction, OtherDeductions
            <br />
            <a
              href="/salary_upload_template.xlsx"
              download
              className="mt-2 inline-block font-medium underline hover:text-blue-900"
            >
              Download sample template →
            </a>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
      </Modal>
    </div>
  );
}
