import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/hooks/use-toast";

export type ReferenceImage = {
  id: string;
  file: File;
  preview: string;
  base64: string;
};

export function useReferenceImages(
  referenceImages: ReferenceImage[],
  setReferenceImages: React.Dispatch<React.SetStateAction<ReferenceImage[]>>,
  isReferenceDragActive: boolean,
  setIsReferenceDragActive: React.Dispatch<React.SetStateAction<boolean>>,
) {
  const { t } = useTranslation();
  const { toast } = useToast();

  function processReferenceFile(file: File) {
    // Validation: file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: t("Invalid file type"),
        description: t("Please upload image files only (PNG, JPG, WebP)"),
        variant: "destructive",
      });
      return;
    }

    // Validation: file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t("File too large"),
        description: t("Images must be under 5MB"),
        variant: "destructive",
      });
      return;
    }

    // Validation: max count
    if (referenceImages.length >= 4) {
      toast({
        title: t("Maximum reached"),
        description: t("You can upload up to 4 reference images"),
        variant: "destructive",
      });
      return;
    }

    // Generate preview and base64
    const reader = new FileReader();
    reader.onload = () => {
      const preview = reader.result as string;

      // Create separate reader for base64 (needed for API)
      const base64Reader = new FileReader();
      base64Reader.onload = () => {
        const base64Full = base64Reader.result as string;
        const base64 = base64Full.split(",")[1]; // Remove data URL prefix

        setReferenceImages((prev) => {
          if (prev.length >= 4) {
            return prev;
          }
          return [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              file,
              preview,
              base64,
            },
          ];
        });
      };
      base64Reader.readAsDataURL(file);
    };
    reader.readAsDataURL(file);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach(processReferenceFile);
    // Reset input to allow re-selecting same file
    e.target.value = "";
  }

  function handleReferenceDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsReferenceDragActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    files.forEach(processReferenceFile);
  }

  function handleReferenceDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (!isReferenceDragActive) {
      setIsReferenceDragActive(true);
    }
  }

  function handleReferenceDragLeave() {
    setIsReferenceDragActive(false);
  }

  function handleRemoveImage(imageId: string) {
    setReferenceImages((prev) => prev.filter((img) => img.id !== imageId));
  }

  return {
    handleImageSelect,
    handleReferenceDrop,
    handleReferenceDragOver,
    handleReferenceDragLeave,
    handleRemoveImage,
  };
}
