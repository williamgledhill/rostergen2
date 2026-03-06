import fs from "fs";
import path from "path";
import { Person, seedPeople } from "./people";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "people.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(seedPeople, null, 2), "utf-8");
}

export function loadPeople(): Person[] {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Person[];
    return parsed;
  } catch {
    return seedPeople;
  }
}

export function savePeople(people: Person[]) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(people, null, 2), "utf-8");
}

export function getPeople(): Person[] {
  return loadPeople();
}

export function getPerson(id: string): Person | null {
  return loadPeople().find(p => p.id === id) ?? null;
}

export function upsertPerson(person: Person) {
  const all = loadPeople();
  const idx = all.findIndex(p => p.id === person.id);
  if (idx >= 0) all[idx] = person;
  else all.push(person);
  savePeople(all);
  return person;
}

export function deletePerson(id: string) {
  const all = loadPeople().filter(p => p.id !== id);
  savePeople(all);
}
