import { getMaterialOptions } from "@/lib/study-material-queries";
import StudyMaterialForm from "../study-material-form";

export default async function NewStudyMaterialPage() {
  const { subjects, departments, staff } = await getMaterialOptions();
  return <StudyMaterialForm subjects={subjects} departments={departments} staff={staff} />;
}
