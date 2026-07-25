"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, Badge, Button, Modal, Field, inputClass, Toast } from "@/components/ui";
import type { Client, Employee, AdvanceRecord, ClientAdvanceSummary } from "@/lib/types";
import { Plus, Trash2, Download, BarChart3, CheckCircle, XCircle, Ban, Clock } from "lucide-react";

const STATUS_COLORS: Record<string, "amber" | "blue" | "green" | "slate" | "red"> = {
  pending: "amber",
  approved: "blue",
  paid: "green",
  hold: "slate",
  rejected: "red",
};

const STATUSES = ["", "pending", "approved", "paid", "hold", "rejected"];

export default function AdvancesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [ledger, setLedger] = useState<AdvanceRecord[]>([]);
  const [summary, setSummary] = useState<ClientAdvanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("admin");
  const [myEmployeeId, setMyEmployeeId] = useState<string>("");
  const [staffEmployeeId, setStaffEmployeeId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const isEmployee = role === "employee";
  const isSupervisor = role === "supervisor";
  const canEdit = role === "admin" || role === "accountant" || role === "supervisor";
  const canDelete = role === "admin" || role === "accountant";
  // Check if viewing Arnav as non-admin staff (read-only view)
  const isArnavRestrictedView = role !== "admin" && role !== "employee" && staffEmployeeId !== null &&
    clients.find(c => c.id === clientId)?.name === "Arnav Enterprises";

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({ type: "given", amount: "", date: new Date().toISOString().slice(0, 10), remarks: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" }>({ msg: "", type: "error" });

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
          } catch { /* ignore */ }
          return;
        }
        const cl = await loadClients();
        if (cl.length) setClientId(cl[0].id);
      })
      .catch(() => {});
  }, [loadClients]);

  useEffect(() => {
    if (!clientId || isEmployee) return;
    api.listEmployees({ clientId }).then(setEmployees);
  }, [clientId, isEmployee]);

  const loadLedger = useCallback(async () => {
    if (!clientId && !isEmployee) return;
    setLoading(true);
    try {
      const params: any = isEmployee
        ? { employeeId: myEmployeeId }
        : employeeId
          ? { employeeId, clientId }
          : { clientId };
      if (statusFilter) params.status = statusFilter;
      const data = await api.listAdvances(params);
      setLedger(data);
    } finally {
      setLoading(false);
    }
  }, [clientId, employeeId, isEmployee, myEmployeeId, statusFilter]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  useEffect(() => {
    if (!isEmployee) api.advanceSummary().then(setSummary).catch(() => setSummary([]));
  }, [isEmployee]);

  function openAdd() {
    setForm({
      type: "given",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      remarks: "",
      employeeId: employeeId || employees[0]?.id || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (isEmployee) {
      if (!form.amount || parseFloat(form.amount) <= 0) {
        setToast({ msg: "Enter a valid amount", type: "error" });
        return;
      }
    } else if (!form.employeeId) {
      setToast({ msg: "Select an employee", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = isEmployee
        ? { date: form.date, amount: parseFloat(form.amount), remarks: form.remarks }
        : {
            employeeId: form.employeeId,
            clientId,
            date: form.date,
            amount: parseFloat(form.amount),
            type: form.type,
            remarks: form.remarks,
          };
      await api.createAdvance(payload);
      setToast({ msg: isEmployee ? "Advance request submitted" : "Advance recorded", type: "success" });
      setModalOpen(false);
      await loadLedger();
    } catch (e: any) {
      setToast({ msg: e.message || "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this advance record?")) return;
    try {
      await api.deleteAdvance(id);
      setToast({ msg: "Record deleted", type: "success" });
      await loadLedger();
    } catch (e: any) {
      setToast({ msg: e.message || "Delete failed", type: "error" });
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api.updateAdvanceStatus(id, status);
      setToast({ msg: `Advance ${status}`, type: "success" });
      await loadLedger();
    } catch (e: any) {
      setToast({ msg: e.message || "Update failed", type: "error" });
    }
  }

  function exportExcel() {
    const qs = new URLSearchParams();
    if (employeeId) qs.set("employeeId", employeeId);
    else qs.set("clientId", clientId);
    window.location.href = `/api/advances/export?${qs.toString()}`;
  }

  const colCount = canEdit && !isArnavRestrictedView ? 9 : 8;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Advances</h1>
          <p className="text-sm text-slate-500">
            {isEmployee ? "Request and track your advance payments." : "Running balance ledger for advances."}
          </p>
        </div>
        <div className="flex gap-2">
          {!isEmployee && (
            <Button variant="secondary" onClick={exportExcel}>
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
          {isArnavRestrictedView ? (
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Viewing your personal data only
            </span>
          ) : (
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" /> {isEmployee ? "Request Advance" : "Add Entry"}
            </Button>
          )}
        </div>
      </div>

      {!isEmployee && (
        <Card className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Client</label>
            <select className={inputClass} value={clientId} onChange={(e) => { setClientId(e.target.value); setEmployeeId(""); }}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Employee (optional)</label>
            <select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">All employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.employeeCode} — {e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
            <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              {STATUSES.filter(Boolean).map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {!isEmployee && summary.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-800">Outstanding Advances by Client</h2>
          </div>
          <div className="space-y-3">
            {summary.map((c) => {
              const max = Math.max(...summary.map((s) => Math.abs(s.outstanding)), 1);
              const pct = (Math.abs(c.outstanding) / max) * 100;
              const positive = c.outstanding >= 0;
              return (
                <div key={c.clientId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{c.name}</span>
                    <span className={`font-semibold ${positive ? "text-rose-600" : "text-emerald-600"}`}>
                      ₹{Math.abs(c.outstanding).toLocaleString("en-IN", { maximumFractionDigits: 0 })}{positive ? " due" : " surplus"}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${positive ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
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
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Running Balance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment Date</th>
              <th className="px-4 py-3">Remarks</th>
              {canEdit && !isArnavRestrictedView && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-center text-slate-400">Loading...</td>
              </tr>
            )}
            {!loading && ledger.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-center text-slate-400">No advance records.</td>
              </tr>
            )}
            {!loading && ledger.map((a) => (
              <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{a.date}</td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {a.employee?.employeeCode} — {a.employee?.name}
                </td>
                <td className="px-4 py-3">
                  <Badge color={a.type === "recovery" ? "red" : "green"}>{a.type}</Badge>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  ₹{Math.abs(a.amount).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-indigo-700">
                  ₹{(a.runningBalance ?? 0).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3">
                  <Badge color={STATUS_COLORS[a.status] || "slate"}>
                    {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">{a.paymentDate || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{a.remarks || "—"}</td>
                {canEdit && !isArnavRestrictedView && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {isSupervisor && a.status === "pending" && (
                        <>
                          <button onClick={() => updateStatus(a.id, "approved")} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50" title="Approve">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button onClick={() => updateStatus(a.id, "rejected")} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Reject">
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {!isSupervisor && a.status === "approved" && (
                        <>
                          <button onClick={() => updateStatus(a.id, "paid")} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50" title="Mark Paid">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button onClick={() => updateStatus(a.id, "hold")} className="rounded p-1.5 text-amber-600 hover:bg-amber-50" title="Hold">
                            <Ban className="h-4 w-4" />
                          </button>
                          <button onClick={() => updateStatus(a.id, "rejected")} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Reject">
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {!isSupervisor && a.status === "hold" && (
                        <>
                          <button onClick={() => updateStatus(a.id, "paid")} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50" title="Mark Paid">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button onClick={() => updateStatus(a.id, "rejected")} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Reject">
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {canDelete && (
                        <button onClick={() => remove(a.id)} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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
        title={isEmployee ? "Request Advance" : "Add Advance Entry"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!isEmployee && (
            <Field label="Employee">
              <select className={inputClass} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.employeeCode} — {e.name}</option>
                ))}
              </select>
            </Field>
          )}
          {!isEmployee && (
            <Field label="Type">
              <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="given">Given (advance)</option>
                <option value="recovery">Recovery</option>
              </select>
            </Field>
          )}
          <Field label="Amount (₹)">
            <input type="number" className={inputClass} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="Date">
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <div className={isEmployee ? "sm:col-span-2" : undefined}>
            <Field label="Remarks">
              <input className={inputClass} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </Field>
          </div>
          {isEmployee && (
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">Your request will be sent to your supervisor for approval.</p>
            </div>
          )}
        </div>
      </Modal>

      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}
