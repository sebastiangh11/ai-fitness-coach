export default function PlanPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Plan
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Browse and manage your training plan. Upcoming sessions will appear here.
      </p>
      {/* TODO: fetch and display the user's training plan */}
    </main>
  );
}
