import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";

/** Shown in place of the editor when the year it would write to is locked. */
export default function LockedNotice({
  title,
  message,
  backHref,
}: {
  title: string;
  message: string;
  backHref: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
          <Lock className="h-6 w-6" />
        </span>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        <p className="max-w-md text-sm text-muted">{message}</p>
        <Link href={backHref} className={buttonClasses({ size: "sm", variant: "outline" })}>
          Back
        </Link>
      </CardContent>
    </Card>
  );
}
