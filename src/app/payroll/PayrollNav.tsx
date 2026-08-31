"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, FileText, DollarSign, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PayrollNav() {
  const pathname = usePathname();

  const tabs = [
    { label: "Calculator / Run", href: "/payroll", icon: Wallet },
    { label: "Execution History", href: "/payroll/history", icon: FileText },
    { label: "Employee Loans", href: "/payroll/loans", icon: DollarSign },
    { label: "Workforce Penalties", href: "/payroll/penalties", icon: FileWarning },
  ];

  return (
    <div className="flex flex-wrap bg-white p-1.5 rounded-2xl border border-[#EDE4D5] shadow-xs gap-1 w-full lg:w-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.href;

        return (
          <Link key={tab.href} href={tab.href}>
            <Button
              variant={isActive ? "default" : "ghost"}
              className={
                isActive
                  ? "bg-[#4A2E1B] text-white font-bold rounded-xl text-xs sm:text-sm"
                  : "text-[#4A2E1B] font-semibold hover:bg-[#F4ECE1] rounded-xl text-xs sm:text-sm"
              }
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          </Link>
        );
      })}
    </div>
  );
}
