import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export interface UnsavedChangesDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirmDiscard?: () => void;
  onStay?: () => void;
  onLeave?: () => void;
  title?: string;
  description?: string;
}

export function UnsavedChangesDialog({
  open,
  isOpen,
  onOpenChange,
  onConfirmDiscard,
  onStay,
  onLeave,
  title,
  description,
}: UnsavedChangesDialogProps) {
  const { language } = useLanguage();

  const isDialogOpen = open !== undefined ? open : (isOpen ?? false);

  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onStay) onStay();
  };

  const handleDiscard = () => {
    if (onOpenChange) onOpenChange(false);
    if (onConfirmDiscard) onConfirmDiscard();
    if (onLeave) onLeave();
  };

  const getTexts = () => {
    switch (language) {
      case "am":
        return {
          defaultTitle: "ያልተቀመጡ ለውጦች አሉ!",
          defaultDesc: "ያልተቀመጡ ለውጦች አሉ። መስኮቱን ከዘጉ ለውጦቹ ይጠፋሉ። እርግጠኛ ነዎት መሰረዝ ይፈልጋሉ?",
          keepEditing: "ማስተካከል ቀጥል",
          discard: "ለውጦችን አጥፋ",
        };
      case "om":
        return {
          defaultTitle: "Jijjiiramoota Hin Qophoofne!",
          defaultDesc: "Jijjiiramoota hin olkayyamin qabdu. Yoo cufte jijjiiramoonni ni badu. Dhuguma dhiisuu barbaadduu?",
          keepEditing: "Gulaaluu Ittifufi",
          discard: "Jijjiirama Balleessi",
        };
      default:
        return {
          defaultTitle: "Unsaved Changes",
          defaultDesc: "You have unsaved changes in this form. If you close now, your changes will be discarded. Are you sure you want to proceed?",
          keepEditing: "Keep Editing",
          discard: "Discard Changes",
        };
    }
  };

  const texts = getTexts();

  return (
    <Dialog open={isDialogOpen} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="max-w-md rounded-2xl bg-white border border-[#EDE4D5] p-6 shadow-xl">
        <DialogHeader className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto sm:mx-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
              {title || texts.defaultTitle}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-[#8C7361] mt-1.5 leading-relaxed">
              {description || texts.defaultDesc}
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="w-full sm:w-auto h-11 rounded-xl border-[#EDE4D5] text-[#4A2E1B] font-bold text-xs sm:text-sm hover:bg-[#FAF6F0]"
          >
            {texts.keepEditing}
          </Button>
          <Button
            type="button"
            onClick={handleDiscard}
            className="w-full sm:w-auto h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-md"
          >
            {texts.discard}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UnsavedChangesDialog;
