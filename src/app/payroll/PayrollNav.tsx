"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, FileText, DollarSign, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PayrollNav() {
  const pathname = usePathname();
  const tabRefs = useRef<{ [key: string]: HTMLAnchorElement | null }>({});

  const tabs = [
    { label: "Payroll", href: "/payroll", icon: Wallet },
    { label: "History", href: "/payroll/history", icon: FileText },
    { label: "Loans", href: "/payroll/loans", icon: DollarSign },
    { label: "Penalties", href: "/payroll/penalties", icon: FileWarning },
  ];

  // Auto-center active tab like profile page
  useEffect(() => {
    const timer = setTimeout(() => {
      const activeLink = tabRefs.current[pathname];
      if (activeLink) {
        activeLink.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div className="relative w-full sm:w-auto max-w-full overflow-hidden">
      {/* Subtle scroll edge gradient hints on mobile to indicate scrollability */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 sm:hidden" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 sm:hidden" />

      <div 
        className="flex items-center gap-1 bg-[#FAF7EE] p-1.5 rounded-2xl border border-[#EDE4D5] overflow-x-auto no-scrollbar scroll-smooth [scroll-padding:0_2rem] shadow-2xs"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <Link 
              key={tab.href} 
              href={tab.href} 
              ref={(el) => { tabRefs.current[tab.href] = el; }}
              className="shrink-0 outline-none"
            >
              <Button
                variant={isActive ? "default" : "ghost"}
                className={
                  isActive
                    ? "bg-[#4A2E1B] text-white font-extrabold rounded-xl text-xs sm:text-sm h-9 sm:h-10 px-3.5 sm:px-4 shrink-0 shadow-sm ring-2 ring-[#4A2E1B]/20"
                    : "text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/60 font-semibold rounded-xl text-xs sm:text-sm h-9 sm:h-10 px-3.5 sm:px-4 shrink-0"
                }
              >
                <Icon className="w-4 h-4 mr-1.5 shrink-0" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
