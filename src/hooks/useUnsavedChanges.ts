"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface UseUnsavedChangesOptions {
  isDirty: boolean;
  fallbackUrl?: string;
}

export function useUnsavedChanges(optionsOrDirty: boolean | UseUnsavedChangesOptions) {
  const isDirty = typeof optionsOrDirty === "boolean" ? optionsOrDirty : optionsOrDirty.isDirty;
  const fallbackUrl = typeof optionsOrDirty === "object" ? optionsOrDirty.fallbackUrl : undefined;

  const router = useRouter();
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
    if (typeof window !== "undefined" && !window.history.state?.unsavedChangesGuard) {
      window.history.pushState({ unsavedChangesGuard: true }, "", window.location.href);
    }

    const handlePopState = () => {
      if (isNavigatingRef.current) return;

      // Intercept back action: show confirmation modal
      setShowDiscardModal(true);
      setPendingAction(() => () => {
        isNavigatingRef.current = true;
        if (fallbackUrl) {
          router.push(fallbackUrl);
        } else {
          router.back();
        }
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty, fallbackUrl, router]);

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
    isNavigatingRef.current = true;
    setShowDiscardModal(false);
    const action = pendingAction;
    setPendingAction(null);
    if (action) {
      action();
    } else if (fallbackUrl) {
      router.push(fallbackUrl);
    } else {
      router.back();
    }
  }, [pendingAction, fallbackUrl, router]);

  const cancelDiscard = useCallback(() => {
    if (isNavigatingRef.current) return;
    setShowDiscardModal(false);
    setPendingAction(null);
    // User cancelled: re-push dummy history entry to continue guarding future back presses
    if (isDirty && typeof window !== "undefined" && !window.history.state?.unsavedChangesGuard) {
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
