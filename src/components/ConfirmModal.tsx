"use client";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, HelpCircle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  const getIcon = () => {
    switch (variant) {
      case "danger":
        return (
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      case "warning":
        return (
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
        );
    }
  };

  const getConfirmButtonStyle = () => {
    switch (variant) {
      case "danger":
        return "bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs";
      case "warning":
        return "bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs";
      default:
        return "bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl shadow-xs";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl p-6">
        <DialogHeader className="flex flex-row items-start gap-4 space-y-0 text-left">
          {getIcon()}
          <div>
            <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
              {title}
            </DialogTitle>
            <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </DialogHeader>

        <DialogFooter className="gap-2 mt-4 pt-2 border-t border-zinc-100">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose} 
            disabled={isLoading}
            className="rounded-xl border-zinc-200 text-zinc-700 font-semibold"
          >
            {cancelText}
          </Button>
          <Button 
            type="button" 
            onClick={handleConfirm} 
            disabled={isLoading}
            className={getConfirmButtonStyle()}
          >
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
