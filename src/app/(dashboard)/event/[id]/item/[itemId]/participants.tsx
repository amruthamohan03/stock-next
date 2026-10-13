"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete, apiRequest } from "@/lib/api-client";
import { averageOf, gradeFor, ordinal, toScore } from "@/lib/event-status";

export type Participant = {
  id: number;
  chest_no: string | null;
  participant_name: string;
  class_name: string | null;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  judge1_score: string | null;
  judge2_score: string | null;
  judge3_score: string | null;
  average_score: string | null;
  grade: string | null;
  place: number | null;
  remarks: string | null;
};

type Form = {
  id?: number;
  chest_no: string;
  participant_name: string;
  class_name: string;
  phone: string;
  parent_name: string;
  parent_phone: string;
  judge1_score: string;
  judge2_score: string;
  judge3_score: string;
  remarks: string;
};

const blank = (): Form => ({
  chest_no: "",
  participant_name: "",
  class_name: "",
  phone: "",
  parent_name: "",
  parent_phone: "",
  judge1_score: "",
  judge2_score: "",
  judge3_score: "",
  remarks: "",
});

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/**
 * The participant register and score card for one item.
 *
 * Scores are shown as a live preview of the average and grade so the person
 * typing from the judges' sheet can check their entry; the server recomputes
 * both on save, and finalising the event fixes the placings.
 */
export default function Participants({
  itemId,
  rows,
  locked,
}: {
  itemId: number;
  rows: Participant[];
  locked: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openAdd = () => {
    setForm(blank());
    setError(null);
    setOpen(true);
  };

  const openEdit = (p: Participant) => {
    setForm({
      id: p.id,
      chest_no: s(p.chest_no),
      participant_name: p.participant_name,
      class_name: s(p.class_name),
      phone: s(p.phone),
      parent_name: s(p.parent_name),
      parent_phone: s(p.parent_phone),
      judge1_score: s(p.judge1_score),
      judge2_score: s(p.judge2_score),
      judge3_score: s(p.judge3_score),
      remarks: s(p.remarks),
    });
    setError(null);
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.participant_name.trim()) {
      setError("Participant name is required.");
      return;
    }
    setBusy(true);
    const result = await apiRequest("/api/event/participant", {
      method: form.id ? "PUT" : "POST",
      body: { ...form, item_id: itemId },
    });
    setBusy(false);
    if (result.success) {
      setOpen(false);
      toast.success(result.message || "Saved");
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  const remove = async (p: Participant) => {
    const ok = await confirm({
      title: `Remove ${p.participant_name}?`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    const result = await apiDelete(`/api/event/participant?id=${p.id}`);
    if (toast.fromResult(result, { success: "Participant removed" })) router.refresh();
  };

  // Live preview while typing — mirrors what the server will store.
  const previewAvg = averageOf([
    toScore(form.judge1_score),
    toScore(form.judge2_score),
    toScore(form.judge3_score),
  ]);

  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle>
          Participants <span className="text-sm font-normal text-muted">({rows.length})</span>
        </CardTitle>
        {!locked && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add participant
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">
            No participants yet{locked ? "." : " — add the first one above."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-2 py-2">Chest</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Class</th>
                  <th className="px-2 py-2 text-right">J1</th>
                  <th className="px-2 py-2 text-right">J2</th>
                  <th className="px-2 py-2 text-right">J3</th>
                  <th className="px-2 py-2 text-right">Average</th>
                  <th className="px-2 py-2 text-center">Grade</th>
                  <th className="px-2 py-2 text-center">Place</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line/60">
                    <td className="px-2 py-2 tabular-nums text-muted">{p.chest_no || "—"}</td>
                    <td className="px-2 py-2 font-medium text-fg">{p.participant_name}</td>
                    <td className="px-2 py-2 text-muted">{p.class_name || "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.judge1_score ?? "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.judge2_score ?? "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.judge3_score ?? "—"}</td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums text-fg">
                      {p.average_score ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-center">{p.grade || "—"}</td>
                    <td className="px-2 py-2 text-center">
                      {p.place ? (
                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-500">
                          {ordinal(p.place)}
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {!locked && (
                        <TableActions>
                          <TableAction tone="edit" icon={Pencil} onClick={() => openEdit(p)} title="Edit" />
                          <TableAction tone="delete" icon={Trash2} onClick={() => remove(p)} title="Remove" />
                        </TableActions>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Edit participant" : "Add participant"}
        size="xl"
      >
        <form onSubmit={save} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label>Chest number</Label>
              <Input
                value={form.chest_no}
                onChange={(e) => setForm({ ...form, chest_no: e.target.value })}
                placeholder="101"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.participant_name}
                onChange={(e) => setForm({ ...form, participant_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Class</Label>
              <Input
                value={form.class_name}
                onChange={(e) => setForm({ ...form, class_name: e.target.value })}
                placeholder="S6 CT"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div />
            <div>
              <Label>Parent name</Label>
              <Input
                value={form.parent_name}
                onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Parent phone</Label>
              <Input
                value={form.parent_phone}
                onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
              />
            </div>
          </div>

          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 text-xs font-medium text-muted">
              Judge scores — leave a judge blank if they did not score this item
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {(["judge1_score", "judge2_score", "judge3_score"] as const).map((k, i) => (
                <div key={k}>
                  <Label>Judge {i + 1}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <Label>Average</Label>
                <Input value={previewAvg === null ? "" : String(previewAvg)} readOnly />
              </div>
              <div>
                <Label>Grade</Label>
                <Input value={gradeFor(previewAvg) ?? ""} readOnly />
              </div>
            </div>
          </div>

          <div>
            <Label>Remarks</Label>
            <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
