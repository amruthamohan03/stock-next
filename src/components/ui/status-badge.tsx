import { Badge } from "@/components/ui/badge";

/**
 * Workflow status pill — indents and documents.
 *
 * A thin wrapper over the shared Badge so the workflow tints live in the same
 * table as every other badge colour in the app.
 */
export function StatusBadge({
  status,
  label,
}: {
  status: string | null | undefined;
  /** Display text, when it should differ from the raw status key. */
  label?: string;
}) {
  const key = status ?? "CREATED";
  return <Badge value={key} label={label ?? key} dot />;
}
