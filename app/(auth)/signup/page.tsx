"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Signup failed. Please try again.");
        return;
      }
      router.push("/plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* ── Left — form ── */}
      <div className="flex flex-col w-full lg:w-[45%] px-8 py-10 lg:px-16">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900 tracking-tight">
            AI Fitness Coach
          </span>
        </div>

        {/* Form — vertically centered */}
        <div className="flex-1 flex flex-col justify-center py-12">
          <div className="w-full max-w-[360px]">
            <h1 className="text-[2.5rem] font-bold text-gray-900 leading-tight">
              Create account
            </h1>
            <p className="mt-1.5 mb-10 text-lg text-gray-400">
              Start building a plan tailored to you.
            </p>

            <form onSubmit={handleSubmit} noValidate className="space-y-3">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                aria-describedby={error ? "form-error" : undefined}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white disabled:opacity-50 transition"
              />

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  aria-describedby={error ? "form-error" : undefined}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3.5 pr-12 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white disabled:opacity-50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {/* Error — always reserves space */}
              <p
                id="form-error"
                role="alert"
                aria-live="polite"
                className="text-sm text-red-500 min-h-[1.25rem] pt-1"
              >
                {error}
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white rounded-2xl py-3.5 text-sm font-semibold hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-60 transition-colors"
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>

            <p className="mt-8 text-sm text-center text-gray-500">
              Already have an account?{" "}
              <a href="/login" className="font-semibold text-gray-900 hover:underline">
                Log in
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* ── Right — product visual ── */}
      <div className="hidden lg:flex flex-1 bg-gray-50 items-center justify-center p-12">
        <AppPreview />
      </div>
    </div>
  );
}

function AppPreview() {
  const exercises = [
    { name: "Bench Press", sets: "4 × 8", pct: 100 },
    { name: "Overhead Press", sets: "3 × 10", pct: 60 },
    { name: "Tricep Dips", sets: "3 × 12", pct: 40 },
    { name: "Lateral Raise", sets: "4 × 15", pct: 0 },
  ];

  const days = ["M", "T", "W", "T", "F"];

  return (
    <div className="w-full max-w-[460px]">
      <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-800/60 border-b border-white/5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="ml-3 text-xs text-gray-500 font-medium">Today&apos;s Plan</span>
        </div>

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-medium">
                Monday
              </p>
              <h2 className="text-white text-lg font-semibold mt-0.5">
                Good morning, Athlete
              </h2>
            </div>
            <div className="bg-gray-800 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Week</p>
              <p className="text-white font-bold text-sm leading-none mt-0.5">3 / 8</p>
            </div>
          </div>

          {/* Workout card */}
          <div className="bg-gray-800 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">
                  Today
                </p>
                <p className="text-white font-semibold mt-0.5">Push Day A</p>
              </div>
              <span className="text-[11px] bg-gray-700 text-gray-400 rounded-full px-2.5 py-1">
                4 exercises
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              {exercises.map((ex) => (
                <div key={ex.name} className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full flex-shrink-0 border-2 transition-colors ${
                      ex.pct === 100
                        ? "bg-emerald-400 border-emerald-400"
                        : "border-gray-600"
                    }`}
                  />
                  <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">
                    {ex.name}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0">{ex.sets}</span>
                  <div className="w-14 h-1 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full bg-gray-400 rounded-full"
                      style={{ width: `${ex.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly progress */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">
                This week
              </p>
              <span className="text-xs text-gray-500">4 / 5 days</span>
            </div>
            <div className="flex gap-1.5">
              {days.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className={`w-full h-1 rounded-full ${
                      i < 4 ? "bg-white" : "bg-gray-700"
                    }`}
                  />
                  <span className="text-[10px] text-gray-600">{day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded-xl p-3.5">
              <p className="text-[11px] text-gray-500 mb-1">Streak</p>
              <p className="text-white font-semibold">12 days</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3.5">
              <p className="text-[11px] text-gray-500 mb-1">Volume</p>
              <p className="text-white font-semibold">18,400 lbs</p>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">
        Your personalized plan, updated every week.
      </p>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
