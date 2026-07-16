import { getKfcItems } from "../../kfc-form-13/items";
import { getSignatories } from "@/lib/signatories";
import KfcForm21Editor from "../kfc21-editor";

export default async function NewKfcForm21Page() {
  const [items, signatories] = await Promise.all([getKfcItems(), getSignatories()]);
  return <KfcForm21Editor items={items} signatories={signatories} />;
}
