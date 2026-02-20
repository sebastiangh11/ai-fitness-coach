export default function ImportPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Import
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Import workouts or training data from a file or external service.
      </p>
      {/* TODO: file upload or OAuth connect for external platforms */}
    </main>
  );
}
