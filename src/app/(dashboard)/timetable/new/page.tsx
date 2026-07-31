import Link from "next/link";
import { Hand, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function NewTimetableChooser() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-fg">Create Timetable</h1>
        <p className="text-sm text-muted">Choose how you want to build it.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/timetable/new/manual" className="group">
          <Card className="h-full p-6 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
              <Hand className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-fg">Manual</h2>
            <p className="mt-1 text-sm text-muted">
              Build the grid yourself — set periods &amp; breaks, then fill each cell with
              subject, faculty and batch.
            </p>
          </Card>
        </Link>

        <Link href="/timetable/new/auto" className="group">
          <Card className="h-full p-6 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
              <Wand2 className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-fg">Automatic</h2>
            <p className="mt-1 text-sm text-muted">
              Auto-schedule a draft from the subjects of a semester and their mapped
              faculty (weekly periods from each subject&apos;s hours). Review &amp; edit before
              saving.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
