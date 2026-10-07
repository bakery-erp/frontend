"use client";

import { useEffect, useState, useCallback } from "react";

interface UseUnsavedChangesOptions {
  isDirty: boolean;
}

export function useUnsavedChanges(optionsOrDirty: boolean | UseUnsavedChangesOptions) {
  const isDirty = typeof optionsOrDirty === "boolean" ? optionsOrDirty : optionsOrDirty.isDirty;
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Browser reload / tab close guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const guardedAction = useCallback(
    (action: () => void) => {
      if (isDirty) {
        setPendingAction(() => action);
        setShowDiscardModal(true);
      } else {
        action();
      }
    },
    [isDirty]
  );

  const confirmDiscard = useCallback(() => {
    setShowDiscardModal(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const cancelDiscard = useCallback(() => {
    setShowDiscardModal(false);
    setPendingAction(null);
  }, []);

  return {
    showDiscardModal,
    showPrompt: showDiscardModal,
    setShowPrompt: setShowDiscardModal,
    guardedAction,
    confirmDiscard,
    confirmAction: confirmDiscard,
    cancelDiscard,
  };
}
