import { getStaffOptions } from "@/lib/staff-queries";
import { getOpenYears } from "@/lib/income-tax-queries";
import TaxEditor from "../tax-editor";
import LockedNotice from "../locked-notice";

export default async function NewIncomeTaxPage() {
  const [staff, years] = await Promise.all([getStaffOptions(), getOpenYears()]);
  if (years.length === 0)
    return (
      <LockedNotice
        title="Every financial year is locked"
        message="Unlock a year under Financial Years on the Income Tax page before adding a statement."
        backHref="/income-tax"
      />
    );
  return <TaxEditor staff={staff} years={years} />;
}
