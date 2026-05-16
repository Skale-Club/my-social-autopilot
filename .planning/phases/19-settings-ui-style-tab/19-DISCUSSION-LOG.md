# Phase 19: Settings UI — Style Tab — Discussion Log

> **Audit trail only.** Decisions are in CONTEXT.md.

**Date:** 2026-05-16
**Phase:** 19-settings-ui-style-tab
**Mode:** --auto (Claude picked recommended defaults)
**Areas decided:** Tab layout, upload flow, grid layout, delete UX, style description, query pattern, state management

---

## Upload Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Client-direct (supabase storage) | Matches logo pattern from settings.tsx | ✓ |
| Via server multipart | Would need multer — not in codebase | |

**Claude's choice:** Client-direct — identical to existing logo upload. Same supabase() client.

---

## Photo Grid Layout

| Option | Description | Selected |
|--------|-------------|----------|
| 5-col responsive grid | 3/4/5 cols on sm/md/lg | ✓ |
| Fixed 2×5 grid | Always 5 columns | |

**Claude's choice:** Responsive grid — consistent with rest of settings page responsiveness.

---

## Delete Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| No confirm dialog | Immediate delete, re-uploadable | ✓ |
| AlertDialog confirm | Safer but adds friction | |

**Claude's choice:** No confirm — photos are easily re-uploaded, no destructive irreversible action.

---

## Claude's Discretion

- `crypto.randomUUID()` for storage filename (browser native, no import needed)
- `group/group-hover` Tailwind pattern for X button visibility
- Character counter position (below textarea, right-aligned)
- `uploadingPhoto: boolean` state (not per-slot) — single upload at a time is sufficient
- `useEffect` to sync `styleDescription` from `brand` context

## Deferred Ideas

- Drag-to-reorder grid (deferred from entire v1.5)
- Photo thumbnails shown in creator dialog preview (Phase 20 scope)
