import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  hasActions?: boolean;
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  hasActions = true,
}: TableSkeletonProps) {
  return (
    <div className="w-full bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
      {/* Header Bar */}
      <div className="bg-[#FAF6F0] px-4 py-3.5 border-b border-[#EDE4D5] flex items-center justify-between gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-4 ${i === 0 ? "w-28" : i === 1 ? "w-36" : "w-20"}`}
          />
        ))}
        {hasActions && <Skeleton className="h-4 w-16" />}
      </div>

      {/* Row List */}
      <div className="divide-y divide-[#EDE4D5]/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="px-4 py-3.5 flex items-center justify-between gap-4"
          >
            {Array.from({ length: columns }).map((_, c) => (
              <div key={c} className="flex items-center gap-2 flex-1 min-w-0">
                {c === 0 && (
                  <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
                )}
                <Skeleton
                  className={`h-4 ${
                    c === 0
                      ? "w-24 sm:w-32"
                      : c === 1
                      ? "w-28 sm:w-40"
                      : "w-16 sm:w-24"
                  }`}
                />
              </div>
            ))}
            {hasActions && (
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="h-8 w-16 rounded-xl" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface KpiCardsSkeletonProps {
  count?: number;
  columns?: string;
}

export function KpiCardsSkeleton({
  count = 4,
  columns = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
}: KpiCardsSkeletonProps) {
  return (
    <div className={`grid ${columns} gap-3 sm:gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-[#EDE4D5] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="w-8 h-8 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface CardGridSkeletonProps {
  count?: number;
  columns?: string;
}

export function CardGridSkeleton({
  count = 8,
  columns = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
}: CardGridSkeletonProps) {
  return (
    <div className={`grid ${columns} gap-4 sm:gap-5`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between"
        >
          <Skeleton className="h-40 sm:h-44 w-full rounded-none" />
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="pt-2 border-t border-[#EDE4D5] flex items-center justify-between">
              <Skeleton className="h-8 w-20 rounded-xl" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-xs space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-2xl shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#EDE4D5]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5 p-3 rounded-xl bg-[#FAF6F0]/60">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-5 w-36" />
          </div>
        ))}
      </div>
    </div>
  );
}
