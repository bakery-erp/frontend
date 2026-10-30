'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { EthDateTime } from 'ethiopian-calendar-date-converter';
import { useDateSettings } from '@/context/DateSettingsContext';

const ETH_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yakatit',
  'Maggabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'
];

function formatYmdLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface AppDatePickerProps {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (val: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
}

export function AppDatePicker({
  name,
  defaultValue,
  value,
  onChange,
  className = '',
  required = false,
  disabled = false,
  id,
  placeholder,
}: AppDatePickerProps) {
  const { isEthiopian } = useDateSettings();
  const [mounted, setMounted] = useState(false);

  // Active value (controlled or uncontrolled fallback)
  const activeVal = value !== undefined ? value : defaultValue;

  // Selected Ethiopian date
  const [ethY, setEthY] = useState(2016);
  const [ethM, setEthM] = useState(1);
  const [ethD, setEthD] = useState(1);

  // Current view in popover (month & year being browsed)
  const [viewYear, setViewYear] = useState(2016);
  const [viewMonth, setViewMonth] = useState(1);

  // Popover open state & view mode ('calendar' | 'month-year')
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'month-year'>('calendar');

  // Gregorian internal string state
  const [gregVal, setGregVal] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    let targetDate = new Date();

    if (activeVal) {
      const parsed = new Date(activeVal);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
        setGregVal(formatYmdLocal(parsed));
      }
    } else {
      setGregVal('');
    }

    try {
      const ec = EthDateTime.fromEuropeanDate(targetDate);
      setEthY(ec.year);
      setEthM(ec.month);
      setEthD(ec.date);
      setViewYear(ec.year);
      setViewMonth(ec.month);
    } catch {
      setEthY(2016);
      setEthM(1);
      setEthD(1);
      setViewYear(2016);
      setViewMonth(1);
    }
  }, [activeVal]);

  // Close popover on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setViewMode('calendar');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setViewMode('calendar');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Today in Ethiopian calendar
  const todayEc = useMemo(() => {
    try {
      return EthDateTime.fromEuropeanDate(new Date());
    } catch {
      return { year: 2019, month: 2, date: 20 };
    }
  }, []);

  // Compute calendar grid cells for current viewYear and viewMonth
  const { prevDays, currDays, nextDays } = useMemo(() => {
    const isLeap = viewYear % 4 === 3;
    const daysInCurrMonth = viewMonth === 13 ? (isLeap ? 6 : 5) : 30;

    let startWeekday = 0;
    try {
      const firstGc = new EthDateTime(viewYear, viewMonth, 1).toEuropeanDate();
      startWeekday = firstGc.getDay(); // 0 is Sunday, 6 is Saturday
    } catch {
      startWeekday = 0;
    }

    const prevMonth = viewMonth === 1 ? 13 : viewMonth - 1;
    const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    const prevIsLeap = prevYear % 4 === 3;
    const daysInPrevMonth = prevMonth === 13 ? (prevIsLeap ? 6 : 5) : 30;

    const pDays: number[] = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      pDays.push(daysInPrevMonth - i);
    }

    const cDays: number[] = [];
    for (let d = 1; d <= daysInCurrMonth; d++) {
      cDays.push(d);
    }

    const totalCells = startWeekday + daysInCurrMonth;
    const targetTotal = totalCells > 35 ? 42 : 35;
    const nextCount = targetTotal - totalCells;

    const nDays: number[] = [];
    for (let d = 1; d <= nextCount; d++) {
      nDays.push(d);
    }

    return { prevDays: pDays, currDays: cDays, nextDays: nDays };
  }, [viewYear, viewMonth]);

  const isLeapYear = ethY % 4 === 3;
  const maxDays = ethM === 13 ? (isLeapYear ? 6 : 5) : 30;
  const safeD = ethD > maxDays ? maxDays : ethD;
  const gcDateObj = mounted ? new EthDateTime(ethY, ethM, safeD).toEuropeanDate() : null;
  const gcDateStr = gcDateObj ? formatYmdLocal(gcDateObj) : gregVal;

  const handleSelectEthDate = (y: number, m: number, d: number) => {
    setEthY(y);
    setEthM(m);
    setEthD(d);
    setViewYear(y);
    setViewMonth(m);

    const dt = new EthDateTime(y, m, d).toEuropeanDate();
    const ymd = formatYmdLocal(dt);
    setGregVal(ymd);
    if (onChange) onChange(ymd);
    setIsOpen(false);
    setViewMode('calendar');
  };

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(13);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 13) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectToday = () => {
    handleSelectEthDate(todayEc.year, todayEc.month, todayEc.date);
  };

  const handleClear = () => {
    setGregVal('');
    if (onChange) onChange('');
    setIsOpen(false);
    setViewMode('calendar');
  };

  const handleGregChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setGregVal(val);
    if (val) {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        try {
          const ec = EthDateTime.fromEuropeanDate(parsed);
          setEthY(ec.year);
          setEthM(ec.month);
          setEthD(ec.date);
          setViewYear(ec.year);
          setViewMonth(ec.month);
        } catch {
          // Ignore conversion error
        }
      }
    }
    if (onChange) onChange(val);
  };

  // If GREGORIAN ("Gero") mode: Native input type="date"
  if (!isEthiopian) {
    return (
      <input
        type="date"
        id={id}
        name={name}
        value={value !== undefined ? value : gregVal}
        onChange={handleGregChange}
        required={required}
        disabled={disabled}
        className={`h-10 px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18]/20 focus:border-[#E87A18] text-zinc-900 dark:text-zinc-100 ${className}`}
      />
    );
  }

  // Display text in Ethiopian mode
  const hasValue = !!(activeVal || gregVal);
  const displayMonthName = ETH_MONTHS[ethM - 1] || `Month ${ethM}`;
  const displayDateText = hasValue
    ? `${displayMonthName} ${safeD}, ${ethY}`
    : placeholder || 'Select date';

  // If ETHIOPIAN mode: Custom Popover Calendar replicating the native "Gero" picker
  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className.includes('w-full') ? 'w-full' : ''}`}
    >
      {name && <input type="hidden" name={name} value={hasValue ? gcDateStr : ''} />}

      {/* Trigger Button - Styled like the browser's date input pill with calendar icon */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`h-10 px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18]/20 focus:border-[#E87A18] text-zinc-900 dark:text-zinc-100 flex items-center justify-between gap-2 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left ${className}`}
      >
        <span className={`font-medium text-xs sm:text-sm truncate ${hasValue ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}>
          {displayDateText}
        </span>
        <svg
          className="w-4 h-4 text-zinc-500 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
          <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" strokeLinecap="round" />
          <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Calendar Popover Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Ethiopian Calendar Picker"
          className="absolute left-0 mt-1.5 z-50 w-[275px] sm:w-[285px] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 shadow-xl rounded-lg p-3 text-zinc-900 dark:text-zinc-100 select-none animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header - Month Year Selector & Up/Down Navigation */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'calendar' ? 'month-year' : 'calendar')}
              className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-[#0075FF] flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer transition-colors"
            >
              <span>{ETH_MONTHS[viewMonth - 1]} {viewYear}</span>
              <span className="text-[10px] text-zinc-500">{viewMode === 'calendar' ? '▾' : '▴'}</span>
            </button>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Previous month"
                aria-label="Previous month"
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold cursor-pointer transition-colors"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                title="Next month"
                aria-label="Next month"
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold cursor-pointer transition-colors"
              >
                ↓
              </button>
            </div>
          </div>

          {/* Body: Month/Year selector mode vs Calendar Days Grid */}
          {viewMode === 'month-year' ? (
            <div className="space-y-2.5 py-1">
              {/* Year controls */}
              <div className="flex items-center justify-between px-2 py-1 bg-zinc-50 dark:bg-zinc-800/60 rounded-md">
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y - 1)}
                  className="px-2 py-0.5 text-xs font-bold rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  ‹
                </button>
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{viewYear}</span>
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y + 1)}
                  className="px-2 py-0.5 text-xs font-bold rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  ›
                </button>
              </div>

              {/* 13 Months Grid */}
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {ETH_MONTHS.map((mName, idx) => {
                  const mNum = idx + 1;
                  const isCurrent = viewMonth === mNum;
                  return (
                    <button
                      key={mNum}
                      type="button"
                      onClick={() => {
                        setViewMonth(mNum);
                        setViewMode('calendar');
                      }}
                      className={`py-1.5 px-1 rounded text-center truncate font-medium cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-[#0075FF] text-white font-bold'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      {mName}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Weekday Row: S M T W T F S */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                <span>S</span>
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
              </div>

              {/* Days 7-column Grid */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {/* Previous month leading days */}
                {prevDays.map((d) => (
                  <button
                    key={`prev-${d}`}
                    type="button"
                    onClick={() => {
                      const pm = viewMonth === 1 ? 13 : viewMonth - 1;
                      const py = viewMonth === 1 ? viewYear - 1 : viewYear;
                      handleSelectEthDate(py, pm, d);
                    }}
                    className="h-7 w-7 sm:h-8 sm:w-8 mx-auto flex items-center justify-center text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded font-normal cursor-pointer transition-colors"
                  >
                    {d}
                  </button>
                ))}

                {/* Current month days */}
                {currDays.map((d) => {
                  const isSelected = hasValue && viewYear === ethY && viewMonth === ethM && d === safeD;
                  const isToday = viewYear === todayEc.year && viewMonth === todayEc.month && d === todayEc.date;

                  return (
                    <button
                      key={`curr-${d}`}
                      type="button"
                      onClick={() => handleSelectEthDate(viewYear, viewMonth, d)}
                      className={`h-7 w-7 sm:h-8 sm:w-8 mx-auto flex items-center justify-center rounded font-medium cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#0075FF] text-white font-bold ring-2 ring-black dark:ring-white shadow-2xs'
                          : isToday
                          ? 'border border-sky-500 text-sky-600 dark:text-sky-400 font-bold hover:bg-sky-50 dark:hover:bg-sky-950/40'
                          : 'text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}

                {/* Next month trailing days */}
                {nextDays.map((d) => (
                  <button
                    key={`next-${d}`}
                    type="button"
                    onClick={() => {
                      const nm = viewMonth === 13 ? 1 : viewMonth + 1;
                      const ny = viewMonth === 13 ? viewYear + 1 : viewYear;
                      handleSelectEthDate(ny, nm, d);
                    }}
                    className="h-7 w-7 sm:h-8 sm:w-8 mx-auto flex items-center justify-center text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded font-normal cursor-pointer transition-colors"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Footer - Clear & Today actions */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            <button
              type="button"
              onClick={handleClear}
              className="text-[#0075FF] hover:underline font-medium cursor-pointer py-0.5 px-1 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-[#0075FF] hover:underline font-medium cursor-pointer py-0.5 px-1 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Default export
export default AppDatePicker;
