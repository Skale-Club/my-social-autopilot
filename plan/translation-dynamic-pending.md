# Dynamic Translation Pending Work

## Goal

Make translation work dynamically through Gemini + `public.translations` for UI text and editable site copy, while preserving generated post content exactly as generated.

## Current State

Already implemented:

- Frontend translation queue now runs after render in [LanguageContext](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/context/LanguageContext.tsx)
- Global translation preloader now uses a delay to reduce flicker in [LanguageContext](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/context/LanguageContext.tsx)
- Backend `/api/translate` reads/writes cached translations in [translate.routes.ts](c:/Users/Vanildo/Dev/my-social-autopilot/server/routes/translate.routes.ts)
- `public.translations` table exists via [20260304000004_create_translations_table.sql](c:/Users/Vanildo/Dev/my-social-autopilot/supabase/migrations/20260304000004_create_translations_table.sql)
- Explicit RLS policy decision is documented in [20260305000007_translations_rls_policy.sql](c:/Users/Vanildo/Dev/my-social-autopilot/supabase/migrations/20260305000007_translations_rls_policy.sql)
- `/api/translate` now has payload guards, dedupe/trim normalization, and anon/auth rate limiting in [translate.routes.ts](c:/Users/Vanildo/Dev/my-social-autopilot/server/routes/translate.routes.ts)
- Main UI wiring already started in:
  - [App.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/App.tsx)
  - [app-sidebar.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/app-sidebar.tsx)
  - [post-creator-dialog.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/post-creator-dialog.tsx)
  - [post-viewer-dialog.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/post-viewer-dialog.tsx)
  - [auth.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/pages/auth.tsx)
  - [landing.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/pages/landing.tsx)

## Non-Translatable Content Rules

These must not be passed through `t()`:

- User input text (`referenceText`, `copyText`, `editPrompt`, form input values)
- Generated post content (`post.caption`, generated headline/subtext, rendered image text)
- Generation prompts and prompt payloads sent to the backend
- Stored AI output shown back to the user

These should use `t()`:

- UI labels
- Buttons
- Dialog titles/descriptions
- Navigation text
- Help text / empty states / status copy
- Error and success messages
- Editable landing/site copy only when it is site UI copy, not user content

## Remaining Frontend Work

### User App Pages

Still need full `t()` coverage review and conversion in:

- [affiliate-dashboard.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/pages/affiliate-dashboard.tsx)
- [credits.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/pages/credits.tsx)
- [onboarding.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/pages/onboarding.tsx)
- [posts.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/pages/posts.tsx)
- [settings.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/pages/settings.tsx)
- [not-found.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/pages/not-found.tsx)

### Shared Components

Still need full `t()` coverage review and conversion in:

- [add-credits-modal.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/add-credits-modal.tsx)
- [voice-input-button.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/voice-input-button.tsx)
- [legal-document.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/legal-document.tsx)

### Admin UI

Admin area still needs broad translation wiring:

- [admin.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/pages/admin.tsx)
- [app-settings-tab.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/app-settings-tab.tsx)
- [landing-page-tab.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/landing-page-tab.tsx)
- [post-creation-tab.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/post-creation-tab.tsx)
- [pricing-tab.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/pricing-tab.tsx)
- [seo-tab.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/seo-tab.tsx)
- [users-tab.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/users-tab.tsx)
- [admin-floating-save-button.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/admin-floating-save-button.tsx)
- [image-upload-field.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/image-upload-field.tsx)
- [stat-card.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/stat-card.tsx)
- [users-table.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/users/users-table.tsx)
- [user-details-dialog.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/users/user-details-dialog.tsx)
- [ai-models-card.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/post-creation/ai-models-card.tsx)
- [brand-styles-card.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/post-creation/brand-styles-card.tsx)
- [post-moods-card.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/components/admin/post-creation/post-moods-card.tsx)

### Landing Page Follow-Up

[landing.tsx](c:/Users/Vanildo/Dev/my-social-autopilot/client/src/pages/landing.tsx) was partially converted, but still needs a cleanup pass for:

- Any remaining hardcoded strings not yet wrapped in `t()`
- Text embedded in helper arrays/constants
- Footer/legal/support copy consistency
- Any alt text that should be localized

## Translation Safety Cleanup

These code-level cleanups are still needed:

- Audit every `t(...)` call in already-converted files to ensure no generated post content is being translated
- Remove any accidental `t()` wrapping around dynamic post data if introduced later
- Keep `content_language` in post generation separate from UI language
- Ensure the content-language selector in the creator only affects `/api/generate`, not the global UI language

## Backend / Data Follow-Up

Still needed:

- Add dashboard-level monitoring/alerts around translation miss rate and provider failures
- Optionally add normalization rules for `source_text` keys if whitespace/casing differences become a cache-fragmentation problem
- Optionally add pruning/maintenance strategy for stale translations if the table grows too large

## Performance / UX Follow-Up

Still needed:

- Consider batching boundaries for long pages with many untranslated strings on first load

## QA Checklist

Still need manual verification in:

- Landing page
- Auth page
- Dashboard / posts page
- Post creator dialog
- Post viewer dialog
- Settings page
- Credits page
- Affiliate dashboard
- Admin tabs

For each screen:

- Change global UI language and verify visible UI text updates
- Confirm first visit triggers dynamic translation only for untranslated UI strings
- Confirm second visit reuses cached translations from `public.translations`
- Confirm generated post content remains untouched
- Confirm content generated with `content_language` follows the selected generation language without being retranslated by UI logic

## Recommended Implementation Order

1. Finish user-facing pages and shared components.
2. Finish the admin area.
3. Run a pass over `landing.tsx` for any missed literals.
4. Perform a strict audit for accidental translation of generated post content.
5. Run end-to-end QA in `en`, `pt`, and `es`.

