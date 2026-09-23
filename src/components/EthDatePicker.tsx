import React, { useState, useEffect } from "react";
import { EthDateTime } from "ethiopian-calendar-date-converter";

const ETH_MONTHS = ["Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yakatit", "Maggabit", "Miyazya", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"];

function formatYmdLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function EthDatePicker({
  name,
  defaultValue,
  value,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (val: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [y, setY] = useState(2016);
  const [m, setM] = useState(1);
  const [d, setD] = useState(1);

  const activeVal = value !== undefined ? value : defaultValue;

  useEffect(() => {
    setMounted(true);
    if (activeVal) {
      const parsed = new Date(activeVal);
      if (!isNaN(parsed.getTime())) {
        const ec = EthDateTime.fromEuropeanDate(parsed);
        setY(ec.year);
        setM(ec.month);
        setD(ec.date);
        return;
      }
    }
    const ec = EthDateTime.fromEuropeanDate(new Date());
    setY(ec.year);
    setM(ec.month);
    setD(ec.date);
  }, [activeVal]);

  const isLeapYear = y % 4 === 3;
  const maxDays = m === 13 ? (isLeapYear ? 6 : 5) : 30;
  const safeD = d > maxDays ? maxDays : d;
  const gcDateObj = mounted ? new EthDateTime(y, m, safeD).toEuropeanDate() : null;
  const gcDateStr = gcDateObj ? formatYmdLocal(gcDateObj) : "";

  const handleMonthChange = (newM: number) => {
    setM(newM);
    if (onChange && mounted) {
      const newMaxDays = newM === 13 ? (isLeapYear ? 6 : 5) : 30;
      const newD = safeD > newMaxDays ? newMaxDays : safeD;
      const dt = new EthDateTime(y, newM, newD).toEuropeanDate();
      onChange(formatYmdLocal(dt));
    }
  };

  const handleDayChange = (newD: number) => {
    setD(newD);
    if (onChange && mounted) {
      const dt = new EthDateTime(y, m, newD).toEuropeanDate();
      onChange(formatYmdLocal(dt));
    }
  };

  const handleYearChange = (newY: number) => {
    setY(newY);
    if (onChange && mounted) {
      const dt = new EthDateTime(newY, m, safeD).toEuropeanDate();
      onChange(formatYmdLocal(dt));
    }
  };

  return (
    <div className="flex flex-row gap-1 border rounded-md px-1 py-1 w-full bg-white text-zinc-900 border-zinc-200">
      <input type="hidden" name={name} value={gcDateStr} />
      
      <select
        className="h-8 bg-transparent text-sm flex-1 outline-none appearance-none"
        value={m}
        onChange={(e) => handleMonthChange(Number(e.target.value))}
      >
        {ETH_MONTHS.map((month, idx) => (
          <option key={idx + 1} value={idx + 1}>{month}</option>
        ))}
      </select>
      
      <span className="text-zinc-300 self-center">/</span>
      
      <select
        className="h-8 bg-transparent text-sm w-12 text-center outline-none appearance-none"
        value={safeD}
        onChange={(e) => handleDayChange(Number(e.target.value))}
      >
        {Array.from({ length: maxDays }, (_, i) => i + 1).map(day => (
          <option key={day} value={day}>{day}</option>
        ))}
      </select>
      
      <span className="text-zinc-300 self-center">/</span>

      <select
        className="h-8 bg-transparent text-sm w-16 text-center outline-none appearance-none"
        value={y}
        onChange={(e) => handleYearChange(Number(e.target.value))}
      >
        {Array.from({ length: 40 }, (_, i) => 2005 + i).map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </div>
  );
}
