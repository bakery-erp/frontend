"use client";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, HelpCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  variant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const resolvedTitle = title || t("common.areYouSure") || "Are you sure?";
  const resolvedDesc = description || t("common.cannotBeUndone") || "This action cannot be undone.";
  const resolvedConfirmText = confirmText || t("common.confirm") || "Confirm";
  const resolvedCancelText = cancelText || t("common.cancel") || "Cancel";

  const handleClose = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  const handleConfirm = async () => {
    await onConfirm();
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


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md rounded-2xl p-6">
        <DialogHeader className="flex flex-row items-start gap-4 space-y-0 text-left">
          {getIcon()}
          <div>
            <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
              {resolvedTitle}
            </DialogTitle>
            <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
              {resolvedDesc}
            </p>
          </div>
        </DialogHeader>

        <DialogFooter className="gap-2 mt-4 pt-2 border-t border-[#EDE4D5]/40">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleClose} 
            disabled={isLoading}
          >
            {resolvedCancelText}
          </Button>
          <Button 
            type="button" 
            onClick={handleConfirm} 
            loading={isLoading}
            loadingText={t("common.processing") || "Processing..."}
            variant={variant === "danger" ? "destructive" : "default"}
          >
            {resolvedConfirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmModal;
