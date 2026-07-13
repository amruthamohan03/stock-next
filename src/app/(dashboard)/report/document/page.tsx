import { getSession } from "@/lib/session";
import DocumentBuilder from "./document-builder";

// Custom document composer — Submission / Justification / Essentiality / custom,
// with a rich-text body, submitted-by block, place & date, and print output.
export default async function DocumentPage() {
  const session = await getSession();
  return (
    <DocumentBuilder
      defaultName={session?.fullName ?? ""}
      defaultDesignation={session?.roleName ?? ""}
    />
  );
}
