import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/server/supabaseServer";
import Sidebar from "@/components/Sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  // Check whether the user has completed onboarding (has a user_settings row).
  // Skip the check (and redirect) when already on /settings or /debug to avoid loops.
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const skipOnboardingCheck = pathname === "/settings" || pathname.startsWith("/debug");

  if (!skipOnboardingCheck) {
    const { data: settingsRow } = await supabase
      .from("user_settings")
      .select("user_id")
      .limit(1)
      .maybeSingle();

    if (settingsRow === null) {
      redirect("/settings?onboarding=1");
    }
  }

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar email={data.user.email ?? null} />
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
