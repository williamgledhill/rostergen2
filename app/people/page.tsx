import PeopleClient from "./PeopleClient";
import { requirePageSession } from "@/lib/apiAuth";
import { getPeople } from "@/lib/peopleStore";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageSession();
  const people = await getPeople();
  return <PeopleClient initialPeople={people} />;
}
