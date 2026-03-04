"use client";

import {
  addDays,
  formatISODate,
  formatMonthLabel,
  isSameWeek,
  monthGridDates,
  startOfWeekMonday,
  todayISO,
} from "@/lib/calendar/dates";

interface MiniMonthProps {
  /** The currently selected week's Monday ISO string. */
  selectedWeekStart: string;
  /** Called with the Monday ISO string of the clicked day's week. */
  onSelectWeek: (weekStartISO: string) => void;
  /** The specific highlighted date (YYYY-MM-DD), if any. */
  selectedDate?: string;
  /** Called with the exact clicked date (YYYY-MM-DD). */
  onSelectDate?: (iso: string) => void;
}

const DOW_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function MiniMonth({ selectedWeekStart, onSelectWeek, selectedDate, onSelectDate }: MiniMonthProps) {
  const today = todayISO();

  // Derive displayed month from the selected week's Monday.
  // Use the Wednesday of that week so the month doesn't flip on Mon/Sun edge weeks.
  const anchorISO = addDays(selectedWeekStart, 2);
  const [anchorY, anchorM] = anchorISO.split("-").map(Number);

  const gridDates = monthGridDates(anchorY, anchorM);

  function prevMonth() {
    const newAnchor = formatISODate(new Date(anchorY, anchorM - 2, 1));
    onSelectWeek(startOfWeekMonday(newAnchor));
  }

  function nextMonth() {
    const newAnchor = formatISODate(new Date(anchorY, anchorM, 1));
    onSelectWeek(startOfWeekMonday(newAnchor));
  }

  return (
    <div className="w-56 shrink-0 select-none">
      {/* Month header */}
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-xs font-semibold text-zinc-300">
          {formatMonthLabel(anchorY, anchorM)}
        </span>
        <button
          onClick={nextMonth}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {DOW_LABELS.map((label) => (
          <span key={label} className="text-[10px] font-medium text-zinc-600">
            {label}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {gridDates.map((iso) => {
          const [, cellMonth, cellDay] = iso.split("-").map(Number);
          const isCurrentMonth = cellMonth === anchorM;
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          const isInSelectedWeek = isSameWeek(iso, selectedWeekStart);
          const weekMon = startOfWeekMonday(iso);

          // Filled circle for the explicitly selected date
          const selectedCls = isSelected
            ? "bg-blue-500 text-white font-bold"
            : isInSelectedWeek
              ? "bg-blue-600/25 font-semibold text-blue-200"
              : "hover:bg-zinc-800";

          // Text colour (lower priority than selectedCls)
          const textCls = isSelected
            ? ""
            : isToday && !isInSelectedWeek
              ? "font-bold text-blue-400"
              : isCurrentMonth
                ? "text-zinc-300"
                : "text-zinc-600";

          return (
            <button
              key={iso}
              onClick={() => {
                onSelectWeek(weekMon);
                onSelectDate?.(iso);
              }}
              className={[
                "flex h-6 w-full items-center justify-center rounded text-[11px] transition-colors",
                selectedCls,
                textCls,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={iso}
            >
              {cellDay}
            </button>
          );
        })}
      </div>
    </div>
  );
}
