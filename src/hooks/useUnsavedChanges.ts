"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface UseUnsavedChangesOptions {
  isDirty: boolean;
}

export function useUnsavedChanges(optionsOrDirty: boolean | UseUnsavedChangesOptions) {
  const isDirty = typeof optionsOrDirty === "boolean" ? optionsOrDirty : optionsOrDirty.isDirty;
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const isNavigatingRef = useRef(false);

  // Browser reload / tab close guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isNavigatingRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Browser & mobile hardware/gesture back guard (popstate)
  useEffect(() => {
    if (!isDirty || isNavigatingRef.current) return;

    // Push dummy history entry so back action triggers popstate instead of instantly unmounting
    window.history.pushState({ unsavedChangesGuard: true }, "", window.location.href);

    const handlePopState = () => {
      if (isNavigatingRef.current) return;

      // Intercept back action: show confirmation modal
      setShowDiscardModal(true);
      setPendingAction(() => () => {
        isNavigatingRef.current = true;
        window.history.back();
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
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
    isNavigatingRef.current = true;
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const cancelDiscard = useCallback(() => {
    setShowDiscardModal(false);
    setPendingAction(null);
    // User cancelled: re-push dummy history entry to continue guarding future back presses
    if (isDirty) {
      window.history.pushState({ unsavedChangesGuard: true }, "", window.location.href);
    }
  }, [isDirty]);

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
