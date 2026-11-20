import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getStaffOptions } from "@/lib/staff-queries";
import { getOpenYears, getStatement } from "@/lib/income-tax-queries";
import TaxEditor from "../../tax-editor";
import LockedNotice from "../../locked-notice";

export default async function EditIncomeTaxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/income-tax/${id}/edit`);
  const [staff, statement, years] = await Promise.all([
    getStaffOptions(),
    getStatement(Number(id), session),
    getOpenYears(),
  ]);
  if (!statement) notFound();
  if (!years.includes(statement.financial_year))
    return (
      <LockedNotice
        title={`FY ${statement.financial_year} is locked`}
        message="This statement is read-only. Unlock the year under Financial Years on the Income Tax page to edit it."
        backHref={`/income-tax/${statement.id}`}
      />
    );
  return <TaxEditor staff={staff} years={years} initial={statement} />;
}
