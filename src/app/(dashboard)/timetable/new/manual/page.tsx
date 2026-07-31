import { getTimetableOptions } from "../../options";
import TimetableBuilder from "../../timetable-builder";

export default async function NewManualTimetablePage() {
  const options = await getTimetableOptions();
  return <TimetableBuilder {...options} />;
}
