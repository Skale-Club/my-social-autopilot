// F5: draft persistence (09.1 D-15..D-22)

export const DRAFT_STORAGE_KEY = "xareable.postCreator.draft";
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // D-19: 7 days
export const DRAFT_DEBOUNCE_MS = 500; // D-20

export type CreatorDraft = {
  savedAt: string;
  contentType: string;
  step: number;
  referenceText: string;
  slideCount: number;
  postMood: string;
  aspectRatio: string;
  imageResolution: "512px" | "1K" | "2K" | "4K";
  videoDuration: "4" | "6" | "8";
  videoResolution: "720p" | "1080p" | "4k";
  useText: boolean;
  copyText: string;
  selectedTextStyleIds: string[];
  useLogo: boolean;
  logoPosition: string;
  contentLanguage: string;
  sceneryId: string | null;
};

export function loadDraft(): CreatorDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreatorDraft;
    if (typeof parsed?.savedAt !== "string") {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }
    const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
    if (Number.isNaN(ageMs) || ageMs > DRAFT_TTL_MS) {
      // D-19: silent expiry
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    // Corrupt JSON — wipe and start fresh
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
    return null;
  }
}

export function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
}

export function saveDraft(draft: Omit<CreatorDraft, "savedAt">): void {
  try {
    const payload: CreatorDraft = { ...draft, savedAt: new Date().toISOString() };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // QuotaExceededError or storage disabled — silently no-op
  }
}
