'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { formatEthDate, EthDateTime, ETH_MONTHS } from '@/lib/ethiopianDate';
import { api } from '@/lib/axios';

export type CalendarType = 'ETHIOPIAN' | 'GREGORIAN';

interface DateSettingsContextType {
  calendarType: CalendarType;
  setCalendarType: (type: CalendarType) => Promise<boolean>;
  formatDate: (dateInput: Date | string | number | null | undefined, includeTime?: boolean) => string;
  formatMonthYear: (year: number, month: number) => string;
  isEthiopian: boolean;
  isLoading: boolean;
}

const DateSettingsContext = createContext<DateSettingsContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'bakery_calendar_preference';

const GREG_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function DateSettingsProvider({ children }: { children: React.ReactNode }) {
  const [calendarType, setCalendarTypeState] = useState<CalendarType>('ETHIOPIAN');
  const [isLoading, setIsLoading] = useState(true);

  // 1. Initial local cache check for instant render
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached === 'ETHIOPIAN' || cached === 'GREGORIAN') {
        setCalendarTypeState(cached);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // 2. Fetch server setting
  useEffect(() => {
    let isMounted = true;
    async function fetchSettings() {
      try {
        const res = await api.get<{ data: { calendarType?: CalendarType } }>('/settings');
        if (isMounted && res.data?.data?.calendarType) {
          const serverType = res.data.data.calendarType;
          setCalendarTypeState(serverType);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, serverType);
          } catch {
            // Ignore storage errors
          }
        }
      } catch (err) {
        // Fallback to cache / default
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update calendar setting (Owner action)
  const setCalendarType = useCallback(async (newType: CalendarType): Promise<boolean> => {
    try {
      setCalendarTypeState(newType);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, newType);
      } catch {
        // Ignore storage errors
      }

      await api.patch('/settings', { calendarType: newType });
      return true;
    } catch (err) {
      console.error('Failed to update calendar settings:', err);
      return false;
    }
  }, []);

  // Format date based on active system calendar
  const formatDate = useCallback(
    (dateInput: Date | string | number | null | undefined, includeTime = false): string => {
      if (!dateInput) return '—';

      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '—';

      if (calendarType === 'ETHIOPIAN') {
        return formatEthDate(d, includeTime);
      }

      // Gregorian formatting
      const month = GREG_MONTHS[d.getMonth()];
      const day = d.getDate();
      const year = d.getFullYear();
      const dateStr = `${month} ${day}, ${year}`;

      if (!includeTime) return dateStr;

      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${dateStr} · ${hours}:${minutes}`;
    },
    [calendarType]
  );

  const formatMonthYear = useCallback(
    (year: number, month: number): string => {
      if (calendarType === 'ETHIOPIAN') {
        const mName = ETH_MONTHS[month - 1] || `Month ${month}`;
        return `${mName} ${year}`;
      }
      const mName = GREG_MONTHS[month - 1] || `Month ${month}`;
      return `${mName} ${year}`;
    },
    [calendarType]
  );

  return (
    <DateSettingsContext.Provider
      value={{
        calendarType,
        setCalendarType,
        formatDate,
        formatMonthYear,
        isEthiopian: calendarType === 'ETHIOPIAN',
        isLoading,
      }}
    >
      {children}
    </DateSettingsContext.Provider>
  );
}

export function useDateSettings() {
  const context = useContext(DateSettingsContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      calendarType: 'ETHIOPIAN' as CalendarType,
      setCalendarType: async () => false,
      formatDate: (date: any, includeTime?: boolean) => formatEthDate(date, includeTime),
      formatMonthYear: (year: number, month: number) => {
        const mName = ETH_MONTHS[month - 1] || `Month ${month}`;
        return `${mName} ${year}`;
      },
      isEthiopian: true,
      isLoading: false,
    };
  }
  return context;
}
