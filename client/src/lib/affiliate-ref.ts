const AFFILIATE_REF_STORAGE_KEY = "affiliate_ref_id";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeRef(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!UUID_REGEX.test(value)) return null;
  return value;
}

export function getStoredAffiliateRef(): string | null {
  if (typeof window === "undefined") return null;
  return normalizeRef(window.localStorage.getItem(AFFILIATE_REF_STORAGE_KEY));
}

export function setStoredAffiliateRef(ref: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeRef(ref);
  if (!normalized) return;
  window.localStorage.setItem(AFFILIATE_REF_STORAGE_KEY, normalized);
}

export function clearStoredAffiliateRef(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AFFILIATE_REF_STORAGE_KEY);
}

export function captureAffiliateRefFromCurrentUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const ref = normalizeRef(params.get("ref"));
  if (!ref) return null;
  setStoredAffiliateRef(ref);
  return ref;
}
