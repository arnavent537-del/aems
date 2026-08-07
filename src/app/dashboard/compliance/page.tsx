"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, Badge, Button, Modal, Field, inputClass, Toast } from "@/components/ui";
import type { Client, ComplianceRecord } from "@/lib/types";
import { COMPLIANCE_FIELDS, defaultComplianceStatuses, statusColor } from "@/lib/compliance";
import { Plus, Pencil, Trash2 } from "lucide-react";

const GROUPS = ["Workflow", "Challan Upload", "Challan Paid"] as const;

function groupSpan(group: string): number {
  return COMPLIANCE_FIELDS.filter((f) => f.group === group).length;
}

const TOTAL_COLUMNS = 2 + COMPLIANCE_FIELDS.length + 1; // client + month + 14 statuses + actions

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function CompliancePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("admin");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ComplianceRecord | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" }>({ msg: "", type: "error" });

  const canEdit = role === "admin" || role === "accountant";

  useEffect(() => {
    api.getMe().then((u) => setRole(u.role)).catch(() => {});
    api.listClients().then(setClients).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listCompliance({ month });
      setRecords(data);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ clientId: clients[0]?.id || "", month, ...defaultComplianceStatuses() });
    setModalOpen(true);
  }

  function openEdit(c: ComplianceRecord) {
    setEditing(c);
    setForm({ ...c });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await api.updateCompliance(editing.id, form);
        setToast({ msg: "Compliance updated", type: "success" });
      } else {
        await api.createCompliance({ clientId: form.clientId, month: form.month });
        setToast({ msg: "Compliance record created", type: "success" });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setToast({ msg: e.message || "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: ComplianceRecord) {
    if (!confirm("Delete this compliance record?")) return;
    try {
      await api.deleteCompliance(c.id);
      setToast({ msg: "Record deleted", type: "success" });
      await load();
    } catch (e: any) {
      setToast({ msg: e.message || "Delete failed", type: "error" });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Compliance</h1>
          <p className="text-sm text-slate-500">Track the monthly compliance workflow per client.</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Record
          </Button>
        )}
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Month</label>
          <input type="month" className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <p className="text-xs text-slate-500">Showing compliance for all clients in this month.</p>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Month</th>
              {GROUPS.map((g) => (
                <th key={g} colSpan={groupSpan(g)} className="border-l border-slate-200 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {g}
                </th>
              ))}
              {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Month</th>
              {COMPLIANCE_FIELDS.map((f) => (
                <th key={f.key} className="whitespace-nowrap border-l border-slate-200 px-4 py-3">
                  {f.label}
                </th>
              ))}
              {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={canEdit ? TOTAL_COLUMNS : TOTAL_COLUMNS - 1} className="px-4 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && records.length === 0 && (
              <tr>
                <td colSpan={canEdit ? TOTAL_COLUMNS : TOTAL_COLUMNS - 1} className="px-4 py-6 text-center text-slate-400">
                  No compliance records for this month.
                </td>
              </tr>
            )}
            {!loading &&
              records.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.client?.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.month}</td>
                  {COMPLIANCE_FIELDS.map((f) => (
                    <td key={f.key} className="whitespace-nowrap border-l border-slate-100 px-4 py-3">
                      <Badge color={statusColor(c[f.key as keyof ComplianceRecord] as string)}>{c[f.key as keyof ComplianceRecord] as string}</Badge>
                    </td>
                  ))}
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(c)} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Delete">
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
        title={editing ? "Edit Compliance" : "Add Compliance Record"}
        onClose={() => setModalOpen(false)}
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
        <div className="space-y-4">
          {!editing && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Client">
                <select className={inputClass} value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Month">
                <input type="month" className={inputClass} value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
              </Field>
            </div>
          )}
          {GROUPS.map((g) => (
            <div key={g} className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{g}</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {COMPLIANCE_FIELDS.filter((f) => f.group === g).map((f) => (
                  <Field key={f.key} label={f.label}>
                    <select className={inputClass} value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                      {f.statuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}
