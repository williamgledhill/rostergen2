import TasksClient from "./TasksClient";
import { requirePageSession } from "@/lib/apiAuth";
import { getTaskTemplates } from "@/lib/taskTemplatesStore";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageSession();
  const templates = await getTaskTemplates();
  return <TasksClient initialTasks={templates} />;
}
