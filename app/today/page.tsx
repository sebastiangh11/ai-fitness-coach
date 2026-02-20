export default function TodayPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Today
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        View and log today&apos;s workout. Your scheduled session will appear here.
      </p>
      {/* TODO: fetch today's scheduled workout and render session logger */}
    </main>
  );
}
