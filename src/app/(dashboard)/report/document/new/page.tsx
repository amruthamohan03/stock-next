import { getSession } from "@/lib/session";
import { getSignatories } from "@/lib/signatories";
import DocumentBuilder from "../document-builder";

export default async function NewDocumentPage() {
  const [session, signatories] = await Promise.all([getSession(), getSignatories()]);
  return (
    <DocumentBuilder
      defaultName={session?.fullName ?? ""}
      defaultDesignation={session?.roleName ?? ""}
      signatories={signatories}
    />
  );
}
