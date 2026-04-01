# Text Styles Enhancement - More Presets + Google Fonts Picker

## Summary

Add more preset text style options and a Google Fonts picker (full-screen Sheet) so users can browse, preview, and select any Google Font as a custom text style for post generation.

## Changes

### 1. Add new preset text styles to `DEFAULT_STYLE_CATALOG` in `shared/schema.ts`

Add 8 new presets to the existing 8:

| id | label | description | font_family preview |
|---|---|---|---|
| `neon-glow` | Neon Glow | Glowing, futuristic typography with neon light effects | `'Orbitron', sans-serif` |
| `handwritten-elegant` | Handwritten | Flowing, elegant handwriting typography | `'Dancing Script', cursive` |
| `graffiti-street` | Graffiti Street | Urban street art and spray-paint style typography | `'Permanent Marker', 'Rock Salt', cursive` |
| `geometric-minimal` | Geometric Minimal | Clean geometric shapes with minimal, modern type | `'Poppins', 'Montserrat', sans-serif` |
| `art-deco` | Art Deco | Glamorous 1920s-style decorative typography | `'Poiret One', cursive` |
| `hand-lettering` | Hand Lettering | Artistic hand-drawn lettering for creative branding | `'Satisfy', 'Sacramento', cursive` |
| `futuristic-tech` | Futuristic Tech | Sleek, cutting-edge typography for tech products | `'Rajdhani', 'Exo 2', sans-serif` |
| `playful-rounded` | Playful Rounded | Friendly, bubbly rounded typography | `'Nunito', 'Quicksand', sans-serif` |

Each will have full `prompt_hints` (typography, layout, emphasis, avoid) and `preview` entries.

### 2. Add `custom_font` field to generate request in `shared/schema.ts`

Add optional field to `generateRequestSchema`:
```ts
custom_font: z.string().min(1).optional(),
```

### 3. Create `client/src/components/google-fonts-picker-sheet.tsx`

A full-screen right-side Sheet component:
- **Header**: Title "Custom Fonts" + search input
- **Font list**: Scrollable list of popular Google Fonts (bundled static list of ~200 to avoid API key dependency)
- **Font card**: Shows font name + sample text rendered in the actual font (loaded on-demand via Google Fonts CSS2 API)
- **Selection**: User selects a font -> it gets added as a custom text style
- **Props**: `open`, `onOpenChange`, `onSelect(font: {family: string, category: string})`, `selectedFontFamily?`
- **Categories filter**: Tabs for Sans, Serif, Display, Handwriting, Monospace
- **Debounce search**: 300ms debounce on search input to filter fonts client-side

### 4. Update `TypographySelector` in `client/src/components/ui/typography-selector.tsx`

Add a second button next to the existing `+` button:
- Existing `+` opens the preset text style popover (unchanged)
- New button (search/Aa icon) opens the Google Fonts Sheet
- When a custom font is selected, show it as a chip alongside presets with a visual indicator
- Store selected custom font in parent state

### 5. Update post-creator-dialog.tsx Step 3

- Add state: `selectedCustomFont`
- Pass custom font data to the TypographySelector
- Include `custom_font` in the generate payload when set

### 6. Update server-side generate flow in `server/routes/generate.routes.ts`

- Extract `custom_font` from validated request body
- Pass it to the Gemini service

### 7. Update `server/services/gemini.service.ts`

- Add `customFont?: string` to `GenerateParams`
- In `buildTextStyleInstruction`: inject custom font into the AI prompt instructions

## Files Modified

| File | Change |
|---|---|
| `shared/schema.ts` | Add 8 new text style presets + `custom_font` field |
| `client/src/components/google-fonts-picker-sheet.tsx` | **New** - Google Fonts browser |
| `client/src/components/ui/typography-selector.tsx` | Add custom font button + chip |
| `client/src/components/post-creator-dialog.tsx` | Add state + custom font in payload |
| `server/routes/generate.routes.ts` | Extract + pass `custom_font` |
| `server/services/gemini.service.ts` | Inject custom font into AI prompt |

## Technical Notes

- Bundle a static list of ~200 popular Google Fonts to avoid needing an API key
- Load font previews on-demand via `https://fonts.googleapis.com/css2?family=FontName&display=swap`
- Use `<link>` tags injected into `<head>` for font loading (no npm packages needed)
- Debounce scroll/font loading to avoid excessive network requests
