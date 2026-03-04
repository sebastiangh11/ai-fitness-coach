import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/server/supabaseServer";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/plan");
  }

  return <>{children}</>;
}
