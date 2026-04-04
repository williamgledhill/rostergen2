import PersonDetailClient from "./PersonDetailClient";
import { requirePageSession } from "@/lib/apiAuth";
import { getPerson } from "@/lib/peopleStore";

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [_, person] = await Promise.all([
    requirePageSession(),
    getPerson(id),
  ]);

  return <PersonDetailClient id={id} initialPerson={person} />;
}
