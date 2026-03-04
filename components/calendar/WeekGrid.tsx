"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, todayISO } from "@/lib/calendar/dates";
import type { PlanDay, WeekPlanSnapshot } from "@/lib/api/types";

// ── Status styles ─────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  planned: "bg-blue-500/20 text-blue-300",
  completed: "bg-green-500/20 text-green-300",
  missed: "bg-red-500/20 text-red-300",
  modified: "bg-amber-500/20 text-amber-300",
};

// ── Sport icons ───────────────────────────────────────────────────────────────

const SESSION_ICON: Record<string, string> = {
  run:      "🏃",
  bike:     "🚴",
  swim:     "🏊",
  strength: "🏋",
  mobility: "🧘",
  hybrid:   "🏃",
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCell() {
  return (
    <div className="min-h-[130px] animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 space-y-1.5">
        <div className="h-2.5 w-8 rounded bg-zinc-800" />
        <div className="h-3 w-14 rounded bg-zinc-800" />
      </div>
      <div className="space-y-1.5">
        <div className="h-2.5 w-full rounded bg-zinc-800" />
        <div className="h-2.5 w-2/3 rounded bg-zinc-800" />
        <div className="mt-2 h-4 w-14 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

// ── Day cell ──────────────────────────────────────────────────────────────────

interface DayCellProps {
  iso: string;
  day: PlanDay | undefined;
  isToday: boolean;
  /** This card is being dragged. */
  isDragging: boolean;
  /** This cell is the active drop target. */
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
}

function DayCell({
  iso,
  day,
  isToday,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDrop,
}: DayCellProps) {
  const router = useRouter();

  const [y, m, d] = iso.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });
  const dateLabel = dateObj.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });

  const s = day?.primary;
  const status = day?.status;
  const badgeCls =
    status !== undefined ? (STATUS_PILL[status] ?? "bg-zinc-700 text-zinc-400") : null;

  // ── Visual states ──────────────────────────────────────────────────────────

  const isActiveDropTarget = isDropTarget && !isDragging;

  const borderCls = isActiveDropTarget
    ? "border-blue-400/60"
    : isToday
      ? "border-blue-500"
      : "border-zinc-800";

  const bgCls = isActiveDropTarget ? "bg-blue-500/[0.06]" : "bg-zinc-900";
  const ringCls = isActiveDropTarget ? "ring-1 ring-inset ring-blue-400/20" : "";

  const dateCls = isToday ? "text-blue-300" : "text-zinc-200";

  const cellCls = [
    "relative min-h-[130px] rounded-lg border p-4 transition-all duration-150",
    borderCls,
    bgCls,
    ringCls,
  ].join(" ");

  // Handlers for this cell acting as a drop zone (fires on all cells)
  const dropZoneHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      onDragEnter();
    },
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      onDragEnter();
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      onDrop();
    },
  };

  const dateHeader = (
    <div className="mb-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {weekday}
      </p>
      <p className={`text-sm font-semibold ${dateCls}`}>{dateLabel}</p>
    </div>
  );

  // ── Session card ───────────────────────────────────────────────────────────

  if (s !== undefined) {
    return (
      <div className={cellCls} {...dropZoneHandlers}>
        {/* Top-edge drop indicator */}
        {isActiveDropTarget && (
          <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-lg bg-blue-400/50" />
        )}

        {/* Draggable session content */}
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", iso);
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          onClick={() => router.push(`/today?date=${iso}`)}
          className={[
            "cursor-grab select-none transition-opacity duration-150 active:cursor-grabbing",
            isDragging ? "opacity-40" : "",
          ].join(" ")}
        >
          {dateHeader}
          <div className="space-y-1.5">
            <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-zinc-100">
              {SESSION_ICON[s.type] !== undefined && (
                <span className="mr-1 not-italic">{SESSION_ICON[s.type]}</span>
              )}
              {s.title}
            </p>
            <p className="text-[11px] text-zinc-500">
              {s.durationMinutes}m
              {s.targetRpe !== undefined ? ` · RPE ${s.targetRpe}` : ""}
              {s.load !== undefined ? ` · Load ${s.load}` : ""}
            </p>
            {badgeCls !== null && (
              <span
                className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeCls}`}
              >
                {status}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Rest day / no-plan cell ────────────────────────────────────────────────

  const emptyContent = isActiveDropTarget ? (
    // Dashed placeholder shown when a workout is dragged over an empty slot
    <div className="rounded border border-dashed border-blue-400/40 bg-blue-500/[0.04] px-2 py-3 text-center">
      <p className="text-[10px] text-blue-400/60">Drop here</p>
    </div>
  ) : day !== undefined ? (
    <span className="inline-flex rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
      rest
    </span>
  ) : (
    <span className="text-xs text-zinc-600">—</span>
  );

  // Rest/empty cells remain clickable via Link
  if (day !== undefined) {
    return (
      <div className={cellCls} {...dropZoneHandlers}>
        {isActiveDropTarget && (
          <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-lg bg-blue-400/50" />
        )}
        <Link
          href={`/today?date=${iso}`}
          className="block transition-colors hover:text-zinc-50"
        >
          {dateHeader}
          {emptyContent}
        </Link>
      </div>
    );
  }

  return (
    <div className={cellCls} {...dropZoneHandlers}>
      {dateHeader}
      {emptyContent}
    </div>
  );
}

// ── Week grid ─────────────────────────────────────────────────────────────────

export interface WeekGridProps {
  weekStartISO: string;
  snapshot: WeekPlanSnapshot | null;
  loading: boolean;
}

export function WeekGrid({ weekStartISO, snapshot, loading }: WeekGridProps) {
  const today = todayISO();
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStartISO, i));

  const [draggingDate, setDraggingDate] = useState<string | null>(null);
  const [overDate, setOverDate] = useState<string | null>(null);

  function handleDragStart(date: string) {
    setDraggingDate(date);
    setOverDate(null);
  }

  function handleDragEnd() {
    setDraggingDate(null);
    setOverDate(null);
  }

  function handleDragEnter(date: string) {
    // Don't highlight the source card as a drop target
    if (date !== draggingDate) setOverDate(date);
  }

  function handleDrop(_date: string) {
    // No backend yet — clear drag state only
    setDraggingDate(null);
    setOverDate(null);
  }

  return (
    <div className="grid grid-cols-7 gap-3">
      {weekDates.map((iso) => {
        if (loading) return <SkeletonCell key={iso} />;
        const day = snapshot?.planDays.find((d) => d.date === iso);
        return (
          <DayCell
            key={iso}
            iso={iso}
            day={day}
            isToday={iso === today}
            isDragging={draggingDate === iso}
            isDropTarget={overDate === iso}
            onDragStart={() => handleDragStart(iso)}
            onDragEnd={handleDragEnd}
            onDragEnter={() => handleDragEnter(iso)}
            onDrop={() => handleDrop(iso)}
          />
        );
      })}
    </div>
  );
}
