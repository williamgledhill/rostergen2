import PeopleClient from "./PeopleClient";
import { requirePageSession } from "@/lib/apiAuth";
import { getPeople } from "@/lib/peopleStore";

export default async function Page() {
  const [_, people] = await Promise.all([requirePageSession(), getPeople()]);
  return <PeopleClient initialPeople={people} />;
}
