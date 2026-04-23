import { redirect } from "next/navigation";
import LoginView from "@/components/LoginView";
import WorkspaceRouter from "@/components/WorkspaceRouter";
import { getSessionContext } from "@/lib/apiAuth";

function encodeNextPath(slug: string[], searchParams: Record<string, string | string[] | undefined>) {
  const path = `/${slug.join("/")}`;
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      return;
    }
    if (typeof value === "string") params.set(key, value);
  });
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export default async function SpaCatchAllPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug = [] }, resolvedSearchParams = {}] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const session = await getSessionContext();

  if (slug[0] === "signup") {
    return <LoginView />;
  }

  if (!session) {
    redirect(`/signup?next=${encodeURIComponent(encodeNextPath(slug, resolvedSearchParams))}`);
  }

  return <WorkspaceRouter user={session.user} />;
}
