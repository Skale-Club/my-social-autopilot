import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, Plus, X } from "lucide-react";
import { GradientIcon } from "@/components/ui/gradient-icon";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { slugifyCatalogId } from "@/lib/admin/utils";
import type { Scenery, StyleCatalog } from "@shared/schema";

interface SceneriesCardProps {
  catalog: StyleCatalog;
  setCatalog: React.Dispatch<React.SetStateAction<StyleCatalog | null>>;
}

export function SceneriesCard({ catalog, setCatalog }: SceneriesCardProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPromptSnippet, setNewPromptSnippet] = useState("");
  const [newPreviewImageUrl, setNewPreviewImageUrl] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);

  // Do NOT fall back to DEFAULT_STYLE_CATALOG.sceneries — the 12 presets are seeded in the DB,
  // not in the DEFAULT constant. An empty array is a valid state (admin deleted all).
  const sceneries = useMemo<Scenery[]>(
    () => catalog.sceneries ?? [],
    [catalog.sceneries]
  );

  function updateScenery(sceneryId: string, updater: (scenery: Scenery) => Scenery) {
    setCatalog((current) => {
      if (!current) return current;
      const currentSceneries = current.sceneries ?? [];
      return {
        ...current,
        sceneries: currentSceneries.map((s) => (s.id === sceneryId ? updater(s) : s)),
      };
    });
  }

  function addScenery() {
    const label = newLabel.trim();
    const promptSnippet = newPromptSnippet.trim();
    const previewUrl = newPreviewImageUrl.trim();

    if (!label) {
      toast({ title: t("Scenery label is required"), variant: "destructive" });
      return;
    }
    if (!promptSnippet) {
      toast({ title: t("Prompt snippet is required"), variant: "destructive" });
      return;
    }

    const baseId = slugifyCatalogId(label);
    if (!baseId) {
      toast({ title: t("Invalid scenery label"), variant: "destructive" });
      return;
    }

    let nextId = baseId;
    let suffix = 2;
    while (sceneries.some((s) => s.id === nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    // Empty preview URL saves as null per D-05
    const nextScenery: Scenery = {
      id: nextId,
      label,
      prompt_snippet: promptSnippet,
      preview_image_url: previewUrl ? previewUrl : null,
      is_active: newIsActive,
    };

    setCatalog((current) => {
      if (!current) return current;
      const currentSceneries = current.sceneries ?? [];
      return {
        ...current,
        sceneries: [...currentSceneries, nextScenery],
      };
    });

    setNewLabel("");
    setNewPromptSnippet("");
    setNewPreviewImageUrl("");
    setNewIsActive(true);
    setIsDialogOpen(false);
  }

  // No minimum-count guard per D-07 — admins can delete all sceneries
  function removeScenery(e: React.MouseEvent | React.KeyboardEvent, sceneryId: string) {
    e.stopPropagation();
    setCatalog((current) => {
      if (!current) return current;
      const currentSceneries = current.sceneries ?? [];
      return {
        ...current,
        sceneries: currentSceneries.filter((s) => s.id !== sceneryId),
      };
    });
  }

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <GradientIcon icon={ImageIcon} className="w-5 h-5" />
            {t("Sceneries")}
          </CardTitle>
          <CardDescription>
            {t("Manage scenery presets available in product photo enhancement.")}
          </CardDescription>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              {t("Add Scenery")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("Add Scenery")}</DialogTitle>
              <DialogDescription>
                {t("Create a new scenery preset for product photo enhancement.")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="scenery-label">{t("Label")}</Label>
                <Input
                  id="scenery-label"
                  autoFocus
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder={t("e.g. Marble Light")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scenery-prompt-snippet">{t("Prompt Snippet")}</Label>
                <Textarea
                  id="scenery-prompt-snippet"
                  value={newPromptSnippet}
                  onChange={(e) => setNewPromptSnippet(e.target.value)}
                  placeholder={t("e.g. Clean light marble surface with soft natural window light...")}
                  className="min-h-[100px] resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scenery-preview-url">{t("Preview Image URL")}</Label>
                <Input
                  id="scenery-preview-url"
                  type="url"
                  value={newPreviewImageUrl}
                  onChange={(e) => setNewPreviewImageUrl(e.target.value)}
                  placeholder={t("https://... (optional)")}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="scenery-is-active">{t("Active")}</Label>
                <Switch
                  id="scenery-is-active"
                  checked={newIsActive}
                  onCheckedChange={setNewIsActive}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={addScenery}>
                {t("Create Scenery")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {sceneries.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg border-dashed">
            {t("No sceneries configured. Add one to get started.")}
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full space-y-2">
            {sceneries.map((s) => (
              <AccordionItem
                key={s.id}
                value={s.id}
                className="border rounded-lg px-3 bg-card data-[state=open]:shadow-sm transition-all"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center justify-between w-full pr-4 gap-4">
                    {/* Left: label + id badge + inactive badge */}
                    <div className="flex flex-col items-start gap-1 min-w-[120px] shrink-0">
                      <span className="font-medium text-sm truncate">{s.label}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {s.id}
                        </span>
                        {!s.is_active ? (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                            {t("Inactive")}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {/* Middle: truncated prompt preview */}
                    <div className="flex-1 flex justify-end min-w-0 px-2 overflow-hidden">
                      <span
                        className="text-xs text-muted-foreground truncate max-w-full text-right"
                        title={s.prompt_snippet}
                      >
                        {s.prompt_snippet}
                      </span>
                    </div>

                    {/* Right: delete — no minimum-count guard (D-07) */}
                    <div
                      role="button"
                      tabIndex={0}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      onClick={(e) => removeScenery(e, s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") removeScenery(e, s.id);
                      }}
                      data-testid={`remove-scenery-${s.id}`}
                    >
                      <X className="w-4 h-4" />
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pt-1 pb-4">
                  <div className="space-y-4">
                    {/* Label */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t("Label")}</Label>
                      <Input
                        value={s.label}
                        onChange={(e) =>
                          updateScenery(s.id, (cur) => ({ ...cur, label: e.target.value }))
                        }
                        className="h-8 shadow-none focus-visible:ring-1"
                      />
                    </div>

                    {/* Prompt snippet — Textarea because this can span multiple sentences (D-01) */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t("Prompt Snippet")}</Label>
                      <Textarea
                        value={s.prompt_snippet}
                        onChange={(e) =>
                          updateScenery(s.id, (cur) => ({ ...cur, prompt_snippet: e.target.value }))
                        }
                        className="min-h-[100px] resize-none shadow-none focus-visible:ring-1 text-xs"
                      />
                    </div>

                    {/* Preview image URL — empty string persists as null (D-05) */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t("Preview Image URL")}</Label>
                      <Input
                        type="url"
                        value={s.preview_image_url ?? ""}
                        placeholder={t("https://... (optional)")}
                        onChange={(e) =>
                          updateScenery(s.id, (cur) => ({
                            ...cur,
                            preview_image_url: e.target.value.trim() ? e.target.value : null,
                          }))
                        }
                        className="h-8 shadow-none focus-visible:ring-1"
                      />
                    </div>

                    {/* Active toggle (D-04) */}
                    <div className="flex items-center justify-between pt-1">
                      <Label className="text-xs text-muted-foreground">{t("Active")}</Label>
                      <Switch
                        checked={s.is_active}
                        onCheckedChange={(next) =>
                          updateScenery(s.id, (cur) => ({ ...cur, is_active: next }))
                        }
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
