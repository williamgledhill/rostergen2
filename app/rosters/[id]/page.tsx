import { redirect } from "next/navigation";

export default function RosterDetail({ params }: { params: { id: string } }) {
  const date = decodeURIComponent(params.id);
  return redirect(`/editor?date=${encodeURIComponent(date)}`);
}
