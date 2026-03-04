import Link from "next/link";
import LogoutButton from "./LogoutButton";

const navLinks = [
  { href: "/today", label: "Today" },
  { href: "/plan", label: "Plan" },
  { href: "/settings", label: "Settings" },
  { href: "/import", label: "Import" },
] as const;

export default function Nav() {
  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
          AI Fitness Coach
        </Link>
        <div className="flex items-center gap-6">
          <ul className="flex gap-6">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden="true" />
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}
