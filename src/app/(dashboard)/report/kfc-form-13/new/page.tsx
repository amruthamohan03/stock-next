import { getKfcItems } from "../items";
import { getSignatories } from "@/lib/signatories";
import KfcForm13Editor from "../kfc-editor";

export default async function NewKfcForm13Page() {
  const [items, signatories] = await Promise.all([getKfcItems(), getSignatories()]);
  return <KfcForm13Editor items={items} signatories={signatories} />;
}
