import Link from "next/link";

const routes = [
  {
    href: "/today",
    label: "Today",
    description: "View and log today's workout.",
  },
  {
    href: "/plan",
    label: "Plan",
    description: "Browse and manage your training plan.",
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Configure your profile and preferences.",
  },
  {
    href: "/import",
    label: "Import",
    description: "Import workouts or training data.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        AI Fitness Coach
      </h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        Your personal AI-powered training assistant.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {routes.map(({ href, label, description }) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {label}
              </span>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
