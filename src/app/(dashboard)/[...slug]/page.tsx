import { Construction } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ComingSoon({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const name = (slug?.[0] ?? "module").replace(/[-_]/g, " ");

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Construction className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-lg font-semibold capitalize text-slate-800">
            {name}
          </h1>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            This module hasn&apos;t been ported to the Next.js foundation yet.
            The database, auth, RBAC, and core modules are ready — this one can
            follow the same patterns.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
