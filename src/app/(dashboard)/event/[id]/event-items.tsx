"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  X,
  Lock,
  CheckCircle2,
  Undo2,
  CalendarDays,
  Trophy,
  Clock,
  MapPin,
  Lightbulb,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TableAction } from "@/components/ui/table-action";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete, apiPatch, apiPost, apiRequest } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  DUTY_ROLE_LABEL,
  eventStatusLabel,
  isEventLocked,
} from "@/lib/event-status";

export type Duty = {
  id: number;
  person_name: string;
  duty_role: string;
};

export type Item = {
  id: number;
  name: string;
  category: string;
  item_type: string;
  stage: string | null;
  venue: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  topic: string | null;
  sort_order: number;
  participant_count: number;
  duties: Duty[];
};

type ItemForm = {
  id?: number;
  name: string;
  category: string;
  item_type: string;
  stage: string;
  venue: string;
  scheduled_date: string;
  scheduled_time: string;
  topic: string;
  sort_order: string;
};

const blankItem = (category: string): ItemForm => ({
  name: "",
  category,
  item_type: "SINGLE",
  stage: "",
  venue: "",
  scheduled_date: "",
  scheduled_time: "",
  topic: "",
  sort_order: "0",
});

/**
 * The event's programme: items split on-stage / off-stage, each with its
 * schedule slot and its duty allocation. Everything here is disabled once the
 * event is finalised — the API refuses the writes regardless.
 */
export default function EventItems({
  eventId,
  status,
  items,
  staff,
  isSuperAdmin,
}: {
  eventId: number;
  status: string;
  items: Item[];
  staff: { value: string; label: string }[];
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const locked = isEventLocked(status);
  const [busy, setBusy] = useState(false);

  // ---- item dialog
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ItemForm>(blankItem("ON_STAGE"));
  const [error, setError] = useState<string | null>(null);

  const openAdd = (category: string) => {
    setForm(blankItem(category));
    setError(null);
    setOpen(true);
  };

  const openEdit = (item: Item) => {
    setForm({
      id: item.id,
      name: item.name,
      category: item.category,
      item_type: item.item_type,
      stage: item.stage ?? "",
      venue: item.venue ?? "",
      scheduled_date: item.scheduled_date ?? "",
      scheduled_time: item.scheduled_time ?? "",
      topic: item.topic ?? "",
      sort_order: String(item.sort_order ?? 0),
    });
    setError(null);
    setOpen(true);
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Item name is required.");
      return;
    }
    setBusy(true);
    const result = await apiRequest("/api/event/item", {
      method: form.id ? "PUT" : "POST",
      body: { ...form, event_id: eventId },
    });
    setBusy(false);
    if (result.success) {
      setOpen(false);
      toast.success(result.message || "Item saved");
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  const removeItem = async (item: Item) => {
    const ok = await confirm({
      title: `Remove "${item.name}"?`,
      description: "Its duty list and participants are removed with it.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    const result = await apiDelete(`/api/event/item?id=${item.id}`);
    if (toast.fromResult(result, { success: "Item removed" })) router.refresh();
  };

  // ---- duty dialog
  const [dutyFor, setDutyFor] = useState<Item | null>(null);
  const [dutyStaff, setDutyStaff] = useState("");
  const [dutyName, setDutyName] = useState("");
  const [dutyRole, setDutyRole] = useState("JUDGE");
  const [dutyError, setDutyError] = useState<string | null>(null);

  const addDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dutyFor) return;
    if (!dutyStaff && !dutyName.trim()) {
      setDutyError("Pick a staff member, or type a name for an outside judge.");
      return;
    }
    setBusy(true);
    const result = await apiPost("/api/event/duty", {
      item_id: dutyFor.id,
      staff_id: dutyStaff || null,
      person_name: dutyName,
      duty_role: dutyRole,
    });
    setBusy(false);
    if (result.success) {
      setDutyStaff("");
      setDutyName("");
      setDutyError(null);
      toast.success("Duty assigned");
      router.refresh();
    } else {
      setDutyError(result.message);
    }
  };

  const removeDuty = async (dutyId: number) => {
    const result = await apiDelete(`/api/event/duty?id=${dutyId}`);
    if (toast.fromResult(result, { success: "Duty removed" })) router.refresh();
  };

  // ---- finalise / reopen
  const move = async (to: "FINALISED" | "OPEN") => {
    const ok = await confirm(
      to === "FINALISED"
        ? {
            title: "Finalise the results?",
            description:
              "Placings are computed from the scores and everything is locked. A Super Admin can reopen it.",
            confirmLabel: "Finalise",
          }
        : {
            title: "Reopen this event?",
            description: "Scores become editable again.",
            confirmLabel: "Reopen",
          }
    );
    if (!ok) return;
    setBusy(true);
    const result = await apiPatch("/api/event", { id: eventId, status: to });
    setBusy(false);
    if (toast.fromResult(result)) router.refresh();
  };

  const byCategory = (category: string) =>
    items.filter((i) => i.category === category);

  const renderGroup = (category: string) => {
    const group = byCategory(category);
    return (
      <Card key={category}>
        <CardHeader>
          <CardTitle>
            {CATEGORY_LABEL[category]} Events{" "}
            <span className="text-sm font-normal text-muted">({group.length})</span>
          </CardTitle>
          {!locked && (
            <Button variant="outline" size="sm" onClick={() => openAdd(category)}>
              <Plus className="h-4 w-4" /> Add item
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {group.length === 0 ? (
            <p className="text-sm text-muted">
              No {CATEGORY_LABEL[category].toLowerCase()} items yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {group.map((item, i) => (
                <li key={item.id} className="evt-item py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    {/* Running order, so the programme reads as a sequence. */}
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-elevated text-xs font-semibold tabular-nums text-muted">
                      {i + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-fg">{item.name}</span>
                        {item.item_type === "GROUP" && (
                          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-500 ring-1 ring-inset ring-violet-500/25">
                            Group
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {(item.scheduled_date || item.scheduled_time) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-500 ring-1 ring-inset ring-sky-500/25">
                            <Clock className="h-3 w-3" />
                            {[
                              item.scheduled_date ? formatDate(item.scheduled_date) : null,
                              item.scheduled_time,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                        {(item.stage || item.venue) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-muted ring-1 ring-inset ring-line">
                            <MapPin className="h-3 w-3" />
                            {item.stage || item.venue}
                          </span>
                        )}
                        {item.topic && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-500 ring-1 ring-inset ring-amber-500/25">
                            <Lightbulb className="h-3 w-3" />
                            {item.topic}
                          </span>
                        )}
                        {!item.scheduled_date && !item.scheduled_time && !item.stage && (
                          <span className="text-faint">Not scheduled</span>
                        )}
                      </div>

                      {/* Duty chips — coordinators amber, judges emerald. */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {item.duties.length === 0 ? (
                          <span className="text-[11px] text-faint">No duties assigned</span>
                        ) : (
                          item.duties.map((d) => (
                            <span
                              key={d.id}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset ${
                                d.duty_role === "COORDINATOR"
                                  ? "bg-amber-500/15 text-amber-500 ring-amber-500/25"
                                  : "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25"
                              }`}
                              title={DUTY_ROLE_LABEL[d.duty_role] ?? d.duty_role}
                            >
                              {d.person_name}
                              {!locked && (
                                <button
                                  type="button"
                                  onClick={() => removeDuty(d.id)}
                                  className="opacity-60 transition-opacity hover:opacity-100"
                                  aria-label={`Remove ${d.person_name}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Link
                        href={`/event/${eventId}/item/${item.id}`}
                        className={buttonClasses({ variant: "outline", size: "sm" })}
                        title="Participants and scores"
                      >
                        <Users className="h-4 w-4" /> {item.participant_count}
                      </Link>
                      {!locked && (
                        <>
                          <TableAction
                            tone="neutral"
                            icon={Plus}
                            onClick={() => {
                              setDutyFor(item);
                              setDutyError(null);
                            }}
                            title="Assign duty"
                          />
                          <TableAction
                            tone="edit"
                            icon={Pencil}
                            onClick={() => openEdit(item)}
                            title="Edit item"
                          />
                          <TableAction
                            tone="delete"
                            icon={Trash2}
                            onClick={() => removeItem(item)}
                            title="Remove item"
                          />
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-5">
          <span className="text-sm text-muted">Status</span>
          <StatusBadge
            status={locked ? "SUBMITTED" : "DRAFT"}
            label={eventStatusLabel(status)}
          />
          {locked && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Lock className="h-3.5 w-3.5" />
              Results published — scores and programme are locked
            </span>
          )}

          <span className="flex-1" />

          <Link
            href={`/event/${eventId}/duty`}
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            <CalendarDays className="h-4 w-4" /> Duty list
          </Link>
          <Link
            href={`/event/${eventId}/results`}
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            <Trophy className="h-4 w-4" /> Results &amp; certificates
          </Link>

          {locked
            ? isSuperAdmin && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => move("OPEN")}>
                  <Undo2 className="h-4 w-4" /> Reopen
                </Button>
              )
            : (
                <Button size="sm" disabled={busy} onClick={() => move("FINALISED")}>
                  <CheckCircle2 className="h-4 w-4" /> Finalise results
                </Button>
              )}
        </CardContent>
      </Card>

      {renderGroup("ON_STAGE")}
      {renderGroup("OFF_STAGE")}

      {/* ---- item dialog ---- */}
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit item" : "Add item"}>
        <form onSubmit={saveItem} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>
                Item name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Light Music (Songs)"
              />
            </div>
            <div>
              <Label>Category</Label>
              <SearchableSelect
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                options={[
                  { value: "ON_STAGE", label: "On Stage" },
                  { value: "OFF_STAGE", label: "Off Stage" },
                ]}
              />
            </div>
            <div>
              <Label>Single or group</Label>
              <SearchableSelect
                value={form.item_type}
                onChange={(v) => setForm({ ...form, item_type: v })}
                options={[
                  { value: "SINGLE", label: "Single" },
                  { value: "GROUP", label: "Group" },
                ]}
              />
            </div>
            <div>
              <Label>Stage</Label>
              <Input
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
                placeholder="Stage 1 (CCF Lab)"
              />
            </div>
            <div>
              <Label>Venue</Label>
              <Input
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={form.scheduled_date}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Time</Label>
              <Input
                value={form.scheduled_time}
                onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                placeholder="9:30 am"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Topic</Label>
              <Input
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="Future World"
              />
            </div>
            <div>
              <Label>Order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- duty dialog ---- */}
      <Modal
        open={!!dutyFor}
        onClose={() => setDutyFor(null)}
        title={dutyFor ? `Duties — ${dutyFor.name}` : "Duties"}
      >
        <form onSubmit={addDuty} className="space-y-4">
          {dutyError && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
              {dutyError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label>Staff member</Label>
              <SearchableSelect
                value={dutyStaff}
                onChange={setDutyStaff}
                options={staff}
                placeholder="Select staff…"
              />
            </div>
            <div>
              <Label>Role</Label>
              <SearchableSelect
                value={dutyRole}
                onChange={setDutyRole}
                options={[
                  { value: "COORDINATOR", label: "Coordinator" },
                  { value: "JUDGE", label: "Judge" },
                ]}
              />
            </div>
            <div className="sm:col-span-3">
              <Label>Or type a name (outside judge)</Label>
              <Input
                value={dutyName}
                onChange={(e) => setDutyName(e.target.value)}
                placeholder="Name of an external judge"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDutyFor(null)}>
              Close
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              <Plus className="h-4 w-4" /> Assign
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
