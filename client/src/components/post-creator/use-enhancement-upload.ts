import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/hooks/use-toast";

export type EnhancementFile = {
  file: File;
  preview: string;
  base64: string;
  mimeType: string;
};

export function useEnhancementUpload(
  isEnhancementDragActive: boolean,
  setEnhancementFile: React.Dispatch<React.SetStateAction<EnhancementFile | null>>,
  setIsEnhancementDragActive: React.Dispatch<React.SetStateAction<boolean>>,
) {
  const { t } = useTranslation();
  const { toast } = useToast();

  function processEnhancementFile(file: File) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({
        title: t("Invalid file type"),
        description: t("Please upload JPEG, PNG, or WEBP images only."),
        variant: "destructive",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t("File too large"),
        description: t("Your photo must be under 5 MB."),
        variant: "destructive",
      });
      return;
    }

    const preview = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] ?? "";
      setEnhancementFile((prev) => {
        if (prev?.preview) URL.revokeObjectURL(prev.preview);
        return { file, preview, base64, mimeType: file.type };
      });
    };
    reader.readAsDataURL(file);
  }

  function handleEnhancementSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processEnhancementFile(file);
    e.target.value = "";
  }

  function handleEnhancementDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsEnhancementDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processEnhancementFile(file);
  }

  function handleEnhancementDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (!isEnhancementDragActive) setIsEnhancementDragActive(true);
  }

  function handleEnhancementDragLeave() {
    setIsEnhancementDragActive(false);
  }

  function clearEnhancementFile() {
    setEnhancementFile((prev) => {
      if (prev?.preview) URL.revokeObjectURL(prev.preview);
      return null;
    });
  }

  return {
    handleEnhancementSelect,
    handleEnhancementDrop,
    handleEnhancementDragOver,
    handleEnhancementDragLeave,
    clearEnhancementFile,
  };
}
