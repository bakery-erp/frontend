'use client';

import React, { useState, useEffect } from 'react';
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
}: AppDatePickerProps) {
  const { isEthiopian } = useDateSettings();
  const [mounted, setMounted] = useState(false);

  // Active value (controlled or uncontrolled fallback)
  const activeVal = value !== undefined ? value : defaultValue;

  // Ethiopian internal state
  const [ethY, setEthY] = useState(2016);
  const [ethM, setEthM] = useState(1);
  const [ethD, setEthD] = useState(1);

  // Gregorian internal state
  const [gregVal, setGregVal] = useState('');

  useEffect(() => {
    setMounted(true);
    let targetDate = new Date();

    if (activeVal) {
      const parsed = new Date(activeVal);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }

    setGregVal(formatYmdLocal(targetDate));

    try {
      const ec = EthDateTime.fromEuropeanDate(targetDate);
      setEthY(ec.year);
      setEthM(ec.month);
      setEthD(ec.date);
    } catch {
      // Fallback
      setEthY(2016);
      setEthM(1);
      setEthD(1);
    }
  }, [activeVal]);

  const isLeapYear = ethY % 4 === 3;
  const maxDays = ethM === 13 ? (isLeapYear ? 6 : 5) : 30;
  const safeD = ethD > maxDays ? maxDays : ethD;
  const gcDateObj = mounted ? new EthDateTime(ethY, ethM, safeD).toEuropeanDate() : null;
  const gcDateStr = gcDateObj ? formatYmdLocal(gcDateObj) : gregVal;

  const handleEthMonthChange = (newM: number) => {
    setEthM(newM);
    const newMaxDays = newM === 13 ? (isLeapYear ? 6 : 5) : 30;
    const newD = safeD > newMaxDays ? newMaxDays : safeD;
    const dt = new EthDateTime(ethY, newM, newD).toEuropeanDate();
    const ymd = formatYmdLocal(dt);
    setGregVal(ymd);
    if (onChange) onChange(ymd);
  };

  const handleEthDayChange = (newD: number) => {
    setEthD(newD);
    const dt = new EthDateTime(ethY, ethM, newD).toEuropeanDate();
    const ymd = formatYmdLocal(dt);
    setGregVal(ymd);
    if (onChange) onChange(ymd);
  };

  const handleEthYearChange = (newY: number) => {
    setEthY(newY);
    const dt = new EthDateTime(newY, ethM, safeD).toEuropeanDate();
    const ymd = formatYmdLocal(dt);
    setGregVal(ymd);
    if (onChange) onChange(ymd);
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
        } catch {
          // Ignore conversion error
        }
      }
    }
    if (onChange) onChange(val);
  };

  // If GREGORIAN ("Gero") mode:
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

  // If ETHIOPIAN mode:
  return (
    <div
      className={`flex flex-row items-center gap-1 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm focus-within:ring-2 focus-within:ring-[#E87A18]/20 focus-within:border-[#E87A18] ${className}`}
    >
      {name && <input type="hidden" name={name} value={gcDateStr} />}

      {/* Month dropdown */}
      <select
        id={id ? `${id}-month` : undefined}
        disabled={disabled}
        className="h-8 bg-transparent text-xs sm:text-sm font-medium flex-1 outline-none cursor-pointer py-1 text-[#4A2E1B] dark:text-zinc-200"
        value={ethM}
        onChange={(e) => handleEthMonthChange(Number(e.target.value))}
      >
        {ETH_MONTHS.map((month, idx) => (
          <option key={idx + 1} value={idx + 1} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
            {month}
          </option>
        ))}
      </select>

      <span className="text-zinc-300 dark:text-zinc-600 select-none">/</span>

      {/* Day dropdown */}
      <select
        id={id ? `${id}-day` : undefined}
        disabled={disabled}
        className="h-8 bg-transparent text-xs sm:text-sm font-medium w-12 text-center outline-none cursor-pointer py-1 text-[#4A2E1B] dark:text-zinc-200"
        value={safeD}
        onChange={(e) => handleEthDayChange(Number(e.target.value))}
      >
        {Array.from({ length: maxDays }, (_, i) => i + 1).map((day) => (
          <option key={day} value={day} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
            {day}
          </option>
        ))}
      </select>

      <span className="text-zinc-300 dark:text-zinc-600 select-none">/</span>

      {/* Year dropdown */}
      <select
        id={id ? `${id}-year` : undefined}
        disabled={disabled}
        className="h-8 bg-transparent text-xs sm:text-sm font-medium w-16 text-center outline-none cursor-pointer py-1 text-[#4A2E1B] dark:text-zinc-200"
        value={ethY}
        onChange={(e) => handleEthYearChange(Number(e.target.value))}
      >
        {Array.from({ length: 40 }, (_, i) => 2005 + i).map((year) => (
          <option key={year} value={year} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}

// Default export
export default AppDatePicker;
