import { getCommitteeOptions } from "@/lib/committee-queries";
import EventForm from "../event-form";

export default async function NewEventPage() {
  const committees = await getCommitteeOptions();
  return <EventForm committees={committees} />;
}
