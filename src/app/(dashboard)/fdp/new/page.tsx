import { getFdpOptions } from "@/lib/fdp-queries";
import FdpForm from "../fdp-form";

export default async function NewFdpPage() {
  const { staff, subjects, departments } = await getFdpOptions();
  return <FdpForm staff={staff} subjects={subjects} departments={departments} />;
}
