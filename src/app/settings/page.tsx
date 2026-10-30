'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useDateSettings, CalendarType } from '@/context/DateSettingsContext';
import { formatPureEthDate, formatGregDate } from '@/lib/ethiopianDate';
import { AppDatePicker } from '@/components/AppDatePicker';
import { toast } from 'sonner';
import {
  Calendar,
  CheckCircle2,
  Settings,
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowRight,
  Globe,
  Flame,
  Check
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const { calendarType, setCalendarType, isLoading: isSettingsLoading } = useDateSettings();
  const [selectedType, setSelectedType] = useState<CalendarType>(calendarType);
  const [isSaving, setIsSaving] = useState(false);
  const [testDate, setTestDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Keep selectedType in sync when settings finish loading
  React.useEffect(() => {
    setSelectedType(calendarType);
  }, [calendarType]);

  const isOwner = user?.role === 'OWNER';
  const today = new Date();

  const handleSave = async () => {
    if (!isOwner) {
      toast.error('Only the System Owner can modify global system settings.');
      return;
    }

    setIsSaving(true);
    try {
      const success = await setCalendarType(selectedType);
      if (success) {
        toast.success(
          `System calendar successfully set to ${
            selectedType === 'ETHIOPIAN' ? 'Ethiopian Calendar' : 'Gregorian (Gero) Calendar'
          }!`,
          {
            description: 'All pages, tables, pickers, and reports are now synchronized.',
          }
        );
      } else {
        toast.error('Failed to update system calendar preference.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7EE] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EADBCC] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#E87A18]/10 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#4A2E1B] flex items-center justify-center text-[#E87A18] shadow-md shadow-[#4A2E1B]/20">
                <Settings className="w-7 h-7 animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#4A2E1B] tracking-tight">
                    Owner Settings
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E87A18]/15 text-[#E87A18] border border-[#E87A18]/30">
                    Executive
                  </span>
                </div>
                <p className="text-sm text-[#8C7361] mt-1">
                  Configure global ERP system behavior, calendars, and organizational preferences.
                </p>
              </div>
            </div>

            {isOwner && (
              <button
                onClick={handleSave}
                disabled={isSaving || selectedType === calendarType}
                className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all duration-200 ${
                  selectedType !== calendarType
                    ? 'bg-[#E87A18] hover:bg-[#d66d12] text-white hover:scale-105 active:scale-95 shadow-[#E87A18]/25'
                    : 'bg-zinc-100 text-zinc-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Preference</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Calendar Selection Main Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EADBCC] shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#E87A18]" />
                <h2 className="text-lg sm:text-xl font-bold text-[#4A2E1B]">
                  System Date & Calendar System
                </h2>
              </div>
              <p className="text-sm text-[#8C7361]">
                Choose whether the ERP operates under the Ethiopian Calendar or the standard Gregorian (&quot;Gero&quot;) Calendar. This applies across all pages, forms, and reports for every employee.
              </p>
            </div>
          </div>

          {/* Cards for Calendar Choice */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* 1. Ethiopian Calendar Option */}
            <div
              onClick={() => isOwner && setSelectedType('ETHIOPIAN')}
              className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all duration-200 ${
                selectedType === 'ETHIOPIAN'
                  ? 'border-[#E87A18] bg-[#FAF5EE] shadow-md shadow-[#E87A18]/10 ring-2 ring-[#E87A18]/20'
                  : 'border-[#EADBCC] hover:border-[#8C7361]/50 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      selectedType === 'ETHIOPIAN'
                        ? 'bg-[#E87A18] text-white'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    🇪🇹
                  </div>
                  <div>
                    <h3 className="font-bold text-[#4A2E1B] text-base">
                      Ethiopian Calendar
                    </h3>
                    <p className="text-xs text-[#8C7361]">የኢትዮጵያ ዘመን አቆጣጠር</p>
                  </div>
                </div>

                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                    selectedType === 'ETHIOPIAN'
                      ? 'border-[#E87A18] bg-[#E87A18] text-white'
                      : 'border-zinc-300 bg-white'
                  }`}
                >
                  {selectedType === 'ETHIOPIAN' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#EADBCC]/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8C7361]">Today&apos;s Date:</span>
                  <span className="font-bold text-[#4A2E1B] bg-white px-2.5 py-1 rounded-lg border border-[#EADBCC]">
                    {formatPureEthDate(today)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8C7361]">Months Format:</span>
                  <span className="font-semibold text-zinc-700">Meskerem – Pagume (13 Months)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8C7361]">Payroll / Sessions:</span>
                  <span className="font-semibold text-emerald-700">Local Ethiopian Fiscal Cycle</span>
                </div>
              </div>
            </div>

            {/* 2. Gregorian Calendar Option */}
            <div
              onClick={() => isOwner && setSelectedType('GREGORIAN')}
              className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all duration-200 ${
                selectedType === 'GREGORIAN'
                  ? 'border-[#E87A18] bg-[#FAF5EE] shadow-md shadow-[#E87A18]/10 ring-2 ring-[#E87A18]/20'
                  : 'border-[#EADBCC] hover:border-[#8C7361]/50 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      selectedType === 'GREGORIAN'
                        ? 'bg-[#E87A18] text-white'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#4A2E1B] text-base">
                      Gregorian Calendar (&quot;Gero&quot;)
                    </h3>
                    <p className="text-xs text-[#8C7361]">ዓለም አቀፍ / ፈረንጅ ዘመን አቆጣጠር</p>
                  </div>
                </div>

                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                    selectedType === 'GREGORIAN'
                      ? 'border-[#E87A18] bg-[#E87A18] text-white'
                      : 'border-zinc-300 bg-white'
                  }`}
                >
                  {selectedType === 'GREGORIAN' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#EADBCC]/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8C7361]">Today&apos;s Date:</span>
                  <span className="font-bold text-[#4A2E1B] bg-white px-2.5 py-1 rounded-lg border border-[#EADBCC]">
                    {formatGregDate(today)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8C7361]">Months Format:</span>
                  <span className="font-semibold text-zinc-700">January – December (12 Months)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8C7361]">Standard:</span>
                  <span className="font-semibold text-blue-700">Standard International ISO</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Date Picker Preview */}
          <div className="mt-6 p-5 rounded-2xl bg-[#FAF7EE] border border-[#EADBCC] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#E87A18]" />
                <h4 className="text-xs sm:text-sm font-bold text-[#4A2E1B]">
                  Live Interactive Date Picker Preview
                </h4>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-[#EADBCC] text-[#8C7361]">
                Simulating: {selectedType === 'ETHIOPIAN' ? 'Ethiopian' : 'Gregorian'}
              </span>
            </div>

            <p className="text-xs text-[#8C7361]">
              Try picking a date below to see how date input fields will look and feel to your staff on forms:
            </p>

            <div className="max-w-md">
              <AppDatePicker
                value={testDate}
                onChange={(val) => setTestDate(val)}
                className="bg-white"
              />
            </div>

            <div className="text-xs text-[#8C7361] flex items-center gap-2 pt-1">
              <span>Standard ISO Output (Saved to DB):</span>
              <code className="font-mono font-bold text-[#4A2E1B] bg-white px-2 py-0.5 rounded border border-[#EADBCC]">
                {testDate}
              </code>
            </div>
          </div>

          {/* System Safety Guarantee Notice */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <p className="font-bold text-emerald-900">
                100% Data Integrity &amp; Safe Conversion
              </p>
              <p className="text-emerald-700 leading-relaxed">
                Switching calendars will never alter your actual financial data, sales records, or stock ledger. The database stores universal timestamps and translates them on-the-fly according to your preference. You can change this setting at any time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
