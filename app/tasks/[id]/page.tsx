import TaskDetailClient from "./TaskDetailClient";
import { requirePageSession } from "@/lib/apiAuth";
import { getTaskTemplateById } from "@/lib/taskTemplatesStore";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [_, task] = await Promise.all([requirePageSession(), getTaskTemplateById(id)]);
  return <TaskDetailClient id={id} initialTask={task} />;
}
