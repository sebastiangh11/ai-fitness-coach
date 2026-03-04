"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

const NAV_LINKS = [
  { href: "/today", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/plan", label: "Plan" },
  { href: "/import", label: "Upload" },
  { href: "/settings", label: "Settings" },
] as const;

interface SidebarProps {
  email: string | null;
}

export default function Sidebar({ email }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-zinc-800 bg-zinc-950 min-h-screen">
      {/* Top: brand + nav */}
      <div>
        <div className="px-6 py-5">
          <span className="text-sm font-semibold text-zinc-50">AI Fitness Coach</span>
        </div>

        <nav className="px-3">
          <ul className="space-y-0.5">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-zinc-800 text-zinc-50"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Bottom: email + sign out */}
      <div className="border-t border-zinc-800 px-6 py-5">
        {email !== null && (
          <p className="mb-3 truncate text-xs text-zinc-500">{email}</p>
        )}
        <LogoutButton />
      </div>
    </aside>
  );
}
