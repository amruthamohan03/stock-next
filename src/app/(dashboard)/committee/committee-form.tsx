"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api-client";
import { COMMITTEE_TYPE_OPTIONS } from "@/lib/committee";

export type CommitteeInitial = {
  id: number;
  name: string;
  committee_type: string;
  academic_year: string;
  description: string;
  order_no: string;
  order_date: string;
};

/**
 * Create or edit a committee. Uses the generic masters route (`committee` is
 * registered in masters-config), so there is no bespoke handler behind this.
 */
export default function CommitteeForm({ initial }: { initial?: CommitteeInitial }) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!initial;

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.committee_type ?? "ARTS");
  const [year, setYear] = useState(initial?.academic_year ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [orderNo, setOrderNo] = useState(initial?.order_no ?? "");
  const [orderDate, setOrderDate] = useState(initial?.order_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Committee name is required.");
      return;
    }
    setSaving(true);
    const result = await apiRequest<{ data?: { id: number } }>("/api/masters/committee", {
      method: editing ? "PUT" : "POST",
      body: {
        id: initial?.id,
        name,
        committee_type: type,
        academic_year: year,
        description,
        order_no: orderNo,
        order_date: orderDate || null,
        display: "Y",
      },
    });
    setSaving(false);
    if (result.success) {
      toast.success(result.message || (editing ? "Committee updated" : "Committee saved"));
      const id = initial?.id ?? result.data?.data?.id;
      router.push(id ? `/committee/${id}` : "/committee");
      router.refresh();
    } else {
      setError(result.message);
      toast.error(result.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? "Edit Committee" : "New Committee"}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(editing ? `/committee/${initial!.id}` : "/committee")}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : editing ? "Update" : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>
              Committee name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="College Arts Committee"
            />
          </div>
          <div>
            <Label>Type</Label>
            <SearchableSelect value={type} onChange={setType} options={COMMITTEE_TYPE_OPTIONS} />
          </div>
          <div>
            <Label>Academic year</Label>
            <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025-26" />
          </div>
          <div>
            <Label>Order number</Label>
            <Input
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              placeholder="GPCNKM/200/2025-C (35)"
            />
          </div>
          <div>
            <Label>Order date</Label>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this committee is responsible for"
            />
          </div>
        </div>

        {!editing && (
          <p className="text-sm text-muted">
            Save first — the appointment order and members are added on the committee&apos;s own page.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
