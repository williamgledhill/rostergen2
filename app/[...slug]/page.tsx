import { redirect } from "next/navigation";
import LoginView from "@/components/LoginView";
import ResetPasswordView from "@/components/ResetPasswordView";
import TwoFactorSetupView from "@/components/TwoFactorSetupView";
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
  const [{ slug = [] }, resolvedSearchParams = {}] = await Promise.all([params, searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({})]);
  const session = await getSessionContext();

  if (slug[0] === "signup" && slug[1] === "two-factor") {
    const next = typeof resolvedSearchParams.next === "string" ? resolvedSearchParams.next : "";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/rosters";
    if (!session) redirect("/signup");
    if (session.user.totpEnabled) redirect(safeNext);
    return <TwoFactorSetupView name={session.user.name} next={safeNext} />;
  }

  if (slug[0] === "signup") {
    return slug[1] === "reset" ? <ResetPasswordView /> : <LoginView />;
  }

  if (!session) {
    redirect(`/signup?next=${encodeURIComponent(encodeNextPath(slug, resolvedSearchParams))}`);
  }

  // Two-factor is required: nothing else opens until it's set up.
  if (!session.user.totpEnabled) {
    redirect(`/signup/two-factor?next=${encodeURIComponent(encodeNextPath(slug, resolvedSearchParams))}`);
  }

  return <WorkspaceRouter user={session.user} />;
}
