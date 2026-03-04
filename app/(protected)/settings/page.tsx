import SettingsForm from "./SettingsForm";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const params = await searchParams;
  const isOnboarding = params.onboarding === "1";
  return <SettingsForm isOnboarding={isOnboarding} />;
}
