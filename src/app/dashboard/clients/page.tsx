"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Badge, Button, Modal, Field, inputClass, Toast } from "@/components/ui";
import type { Client } from "@/lib/types";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<any>({ name: "", pfApplicable: true, esicApplicable: true, ptApplicable: true, isInfinity: false });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" }>({ msg: "", type: "error" });

  async function load() {
    setLoading(true);
    try {
      const cl = await api.listClients();
      setClients(cl);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", pfApplicable: true, esicApplicable: true, ptApplicable: true, isInfinity: false });
    setModalOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({ name: c.name, pfApplicable: c.pfApplicable, esicApplicable: c.esicApplicable, ptApplicable: c.ptApplicable, isInfinity: c.isInfinity });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name || !form.name.trim()) {
      setToast({ msg: "Client name is required", type: "error" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.updateClient(editing.id, form);
        setToast({ msg: "Client updated", type: "success" });
      } else {
        await api.createClient(form);
        setToast({ msg: "Client created", type: "success" });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setToast({ msg: e.message || "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Client) {
    if (!confirm(`Delete client ${c.name}? This removes all related records (employees, attendance, salaries, advances, compliance).`)) return;
    try {
      await api.deleteClient(c.id);
      setToast({ msg: "Client deleted", type: "success" });
      await load();
    } catch (e: any) {
      setToast({ msg: e.message || "Delete failed", type: "error" });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Client Manager</h1>
          <p className="text-sm text-slate-500">Create, update, and remove clients (admin only).</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Infinity</th>
              <th className="px-4 py-3">PF</th>
              <th className="px-4 py-3">ESIC</th>
              <th className="px-4 py-3">PT</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No clients yet.
                </td>
              </tr>
            )}
            {!loading &&
              clients.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-indigo-50 align-middle">
                      <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                    </span>
                    {c.name}
                  </td>
                  <td className="px-4 py-3"><Badge color={c.isInfinity ? "purple" : "slate"}>{c.isInfinity ? "Yes" : "No"}</Badge></td>
                  <td className="px-4 py-3"><Badge color={c.pfApplicable ? "green" : "slate"}>{c.pfApplicable ? "On" : "Off"}</Badge></td>
                  <td className="px-4 py-3"><Badge color={c.esicApplicable ? "green" : "slate"}>{c.esicApplicable ? "On" : "Off"}</Badge></td>
                  <td className="px-4 py-3"><Badge color={c.ptApplicable ? "green" : "slate"}>{c.ptApplicable ? "On" : "Off"}</Badge></td>
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
                </tr>
              ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? "Edit Client" : "Add Client"}
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
          <Field label="Client Name">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Shree Ashtvinayak Glass" />
          </Field>
          <div className="grid grid-cols-4 gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!form.isInfinity} onChange={(e) => setForm({ ...form, isInfinity: e.target.checked })} />
              Infinity
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!form.pfApplicable} onChange={(e) => setForm({ ...form, pfApplicable: e.target.checked })} />
              PF
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!form.esicApplicable} onChange={(e) => setForm({ ...form, esicApplicable: e.target.checked })} />
              ESIC
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!form.ptApplicable} onChange={(e) => setForm({ ...form, ptApplicable: e.target.checked })} />
              PT
            </label>
          </div>
        </div>
      </Modal>

      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}
