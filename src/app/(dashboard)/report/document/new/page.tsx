import { getSession } from "@/lib/session";
import { getSignatories } from "@/lib/signatories";
import { getKfcFormOptions } from "@/lib/kfc-forms";
import DocumentBuilder from "../document-builder";

export default async function NewDocumentPage() {
  const [session, signatories, kfcForms] = await Promise.all([
    getSession(),
    getSignatories(),
    getKfcFormOptions(),
  ]);
  return (
    <DocumentBuilder
      defaultName={session?.fullName ?? ""}
      defaultDesignation={session?.roleName ?? ""}
      signatories={signatories}
      kfcForms={kfcForms}
    />
  );
}
