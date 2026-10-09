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

export type EventInitial = {
  id: number;
  committee_id: string;
  name: string;
  subtitle: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  venue: string;
  adviser_name: string;
  principal_name: string;
};

export type CommitteeOption = { value: string; label: string };

/** Create or edit a festival's header — the details printed on every sheet. */
export default function EventForm({
  committees,
  initial,
}: {
  committees: CommitteeOption[];
  initial?: EventInitial;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!initial;

  const [committeeId, setCommitteeId] = useState(initial?.committee_id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [year, setYear] = useState(initial?.academic_year ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [adviser, setAdviser] = useState(initial?.adviser_name ?? "");
  const [principal, setPrincipal] = useState(initial?.principal_name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Event name is required.");
      return;
    }
    setSaving(true);
    const result = await apiRequest<{ id?: number }>("/api/event", {
      method: editing ? "PUT" : "POST",
      body: {
        id: initial?.id,
        committee_id: committeeId || null,
        name,
        subtitle,
        academic_year: year,
        start_date: startDate,
        end_date: endDate,
        venue,
        adviser_name: adviser,
        principal_name: principal,
      },
    });
    setSaving(false);
    if (result.success) {
      toast.success(result.message || (editing ? "Event updated" : "Event saved"));
      const id = initial?.id ?? (result.data as { id?: number } | undefined)?.id;
      router.push(id ? `/event/${id}` : "/event");
      router.refresh();
    } else {
      setError(result.message);
      toast.error(result.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? "Edit Event" : "New Event"}</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/event")}>
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
          <div>
            <Label>
              Event name <span className="text-red-500">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="MASTHI 2K26" />
          </div>
          <div>
            <Label>Subtitle</Label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Arts Festival 2026"
            />
          </div>
          <div>
            <Label>Committee</Label>
            <SearchableSelect
              value={committeeId}
              onChange={setCommitteeId}
              options={committees}
              placeholder="Select committee…"
            />
          </div>
          <div>
            <Label>Academic year</Label>
            <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025-26" />
          </div>
          <div>
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Venue</Label>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div>
            <Label>Arts adviser</Label>
            <Input
              value={adviser}
              onChange={(e) => setAdviser(e.target.value)}
              placeholder="Signs the certificates"
            />
          </div>
          <div>
            <Label>Principal</Label>
            <Input value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
