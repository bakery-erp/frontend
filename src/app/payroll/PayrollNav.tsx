"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, FileText, DollarSign, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PayrollNav() {
  const pathname = usePathname();

  const tabs = [
    { label: "Payroll", href: "/payroll", icon: Wallet },
    { label: "History", href: "/payroll/history", icon: FileText },
    { label: "Loans", href: "/payroll/loans", icon: DollarSign },
    { label: "Penalties", href: "/payroll/penalties", icon: FileWarning },
  ];

  return (
    <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto scrollbar-none bg-white p-1.5 rounded-2xl border border-[#EDE4D5] shadow-xs gap-1 w-full sm:w-auto max-w-full">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.href;

        return (
          <Link key={tab.href} href={tab.href} className="shrink-0">
            <Button
              variant={isActive ? "default" : "ghost"}
              className={
                isActive
                  ? "bg-[#4A2E1B] text-white font-bold rounded-xl text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 shrink-0 shadow-xs"
                  : "text-[#4A2E1B] font-semibold hover:bg-[#F4ECE1] rounded-xl text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 shrink-0"
              }
            >
              <Icon className="w-4 h-4 mr-1.5 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </Button>
          </Link>
        );
      })}
    </div>
  );
}
