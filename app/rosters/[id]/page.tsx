import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/apiAuth";

export default async function RosterDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePageSession();
  const { id } = await params;
  const date = decodeURIComponent(id);
  return redirect(`/editor?date=${encodeURIComponent(date)}`);
}
