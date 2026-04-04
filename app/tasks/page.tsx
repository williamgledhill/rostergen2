import TasksClient from "./TasksClient";
import { requirePageSession } from "@/lib/apiAuth";
import { getTaskTemplates } from "@/lib/taskTemplatesStore";

export default async function Page() {
  const [_, templates] = await Promise.all([requirePageSession(), getTaskTemplates()]);
  return <TasksClient initialTasks={templates} />;
}
