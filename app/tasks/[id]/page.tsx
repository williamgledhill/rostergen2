import TaskDetailClient from "./TaskDetailClient";
import { requirePageSession } from "@/lib/apiAuth";
import { getTaskTemplateById } from "@/lib/taskTemplatesStore";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageSession();
  const { id } = await params;
  const task = await getTaskTemplateById(id);
  return <TaskDetailClient id={id} initialTask={task} />;
}
