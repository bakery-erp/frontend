"use client";
import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "./button";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  isLoading?: boolean;
  itemLabel?: string;
  className?: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  itemLabel = "items",
  className = "",
}: PaginationControlsProps) {
  if (totalPages <= 1 && (!totalItems || totalItems === 0)) {
    return null;
  }

  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const effectivePageSize = pageSize || 20;

  const startItem = totalItems != null ? Math.min((safeCurrentPage - 1) * effectivePageSize + 1, totalItems) : null;
  const endItem = totalItems != null ? Math.min(safeCurrentPage * effectivePageSize, totalItems) : null;

  // Generate visible page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);

      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("...");

      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-1 text-xs text-[#8C7361] ${className}`}>
      {/* Items count summary */}
      <div className="flex items-center gap-2">
        {totalItems != null && startItem != null && endItem != null ? (
          <div>
            Showing <strong className="text-[#2C1B10] font-semibold">{startItem}</strong> to{" "}
            <strong className="text-[#2C1B10] font-semibold">{endItem}</strong> of{" "}
            <strong className="text-[#2C1B10] font-semibold">{totalItems}</strong> {itemLabel}
          </div>
        ) : (
          <div>
            Page <strong className="text-[#2C1B10] font-semibold">{safeCurrentPage}</strong> of{" "}
            <strong className="text-[#2C1B10] font-semibold">{totalPages}</strong>
          </div>
        )}

        {/* Optional Page size selector */}
        {onPageSizeChange && pageSize && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-zinc-200 pl-3">
            <span className="text-[11px] text-[#8C7361]">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={isLoading}
              className="bg-white border border-[#EDE4D5] text-[#2C1B10] rounded-lg text-xs py-1 px-1.5 focus:outline-none focus:ring-1 focus:ring-[#4A2E1B]"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safeCurrentPage <= 1 || isLoading}
          onClick={() => onPageChange(1)}
          className="h-8 w-8 p-0 rounded-lg border-[#EDE4D5] text-[#2C1B10] hover:bg-[#FAF7EE] disabled:opacity-40"
          title="First page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safeCurrentPage <= 1 || isLoading}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          className="h-8 px-2 rounded-lg border-[#EDE4D5] text-[#2C1B10] hover:bg-[#FAF7EE] disabled:opacity-40 flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs font-semibold">Prev</span>
        </Button>

        {/* Page buttons */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`dots-${idx}`} className="px-1 text-zinc-400">
                  ...
                </span>
              );
            }
            const pageNum = p as number;
            const isActive = pageNum === safeCurrentPage;
            return (
              <Button
                key={pageNum}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                disabled={isLoading}
                onClick={() => onPageChange(pageNum)}
                className={`h-8 w-8 p-0 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#4A2E1B] text-white hover:bg-[#3D2516] shadow-xs"
                    : "border-[#EDE4D5] text-[#2C1B10] hover:bg-[#FAF7EE]"
                }`}
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safeCurrentPage >= totalPages || isLoading}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          className="h-8 px-2 rounded-lg border-[#EDE4D5] text-[#2C1B10] hover:bg-[#FAF7EE] disabled:opacity-40 flex items-center gap-1"
        >
          <span className="hidden sm:inline text-xs font-semibold">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safeCurrentPage >= totalPages || isLoading}
          onClick={() => onPageChange(totalPages)}
          className="h-8 w-8 p-0 rounded-lg border-[#EDE4D5] text-[#2C1B10] hover:bg-[#FAF7EE] disabled:opacity-40"
          title="Last page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default PaginationControls;
