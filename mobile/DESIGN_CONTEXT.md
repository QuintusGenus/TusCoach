# TusCoach — Design Context Pack

> Paste this whole file at the start of any Claude design session. It gives the tool
> deep, accurate knowledge of the app so redesigns match the existing language and
> **drop in without breaking navigation, data, or state.** Redesign the *presentation
> layer only*.

---

## 1. What the app is

**TusCoach** — a mobile app that coaches Turkish medical graduates through **TUS**
(the medical-residency entrance exam). Users build a personalized multi-week study
**plan**, run a study **chronometer**, practice **question banks**, track **progress/
analytics**, and chat with an **AI coach**. All UI copy is **Turkish**.

- **Stack:** React Native + **Expo Router** (file-based routing), **React Query**
  (server state), **Zustand** (client state), `react-native-svg` (rings/charts),
  `@expo/vector-icons/MaterialIcons` (icons only — no other icon set).
- **Backend:** FastAPI at `/v1`; the mobile app talks to it via `src/api/*`.

---

## 2. Design language (keep this identity)

- **Material 3-inspired**, card-based, generous rounding, soft shadows, lots of
  breathing room. Calm and clinical-but-warm.
- **One brand color does the heavy lifting:** deep teal **#00445C**. Avoid rainbow
  clutter — subject colors are the *only* place many hues appear, and only for
  data (calendar, charts, block bars).
- Rounded cards on a near-white (light) / near-black (dark) surface. Pills for
  chips/badges. Circular progress rings. Bottom tab bar with floating rounded style.
- Full **light + dark** themes exist and must both be supported.

---

## 3. Design tokens — USE THESE, DO NOT INVENT

All tokens live in `src/ui/theme.ts`. In components, get colors from the hook
`useThemeColors()` (returns the correct palette for the active theme). Use
`typography`, `spacing`, `radius`, `shadows` (static exports) for the rest.

### 3a. Color — LIGHT palette
```
primary:    main #00445C  container #035D7B  onPrimary #FFFFFF  onContainer #92D4F7  fixed #C1E8FF  fixedDim #8DCFF2
secondary:  main #006A62  container #81F3E5  onContainer #006F66  fixed #84F5E8  fixedDim #66D9CC
tertiary:   main #771F00  container #A02C00  onContainer #FFBCA8  fixed #FFDBD0  fixedDim #FFB59F
surface:    main #F6FAFB  containerLowest #FFFFFF  containerLow #F0F4F5  container #EAEEF0  containerHigh #E5E9EA  containerHighest #DFE3E4
onSurface:  main #181C1D  variant #3F4949  inverse #EDF1F2
outline:    main #6F7979  variant #BEC8C9
error:      main #BA1A1A  container #FFDAD6  onError #FFFFFF
status:     success #22C55E  warning #FFB020  danger #EF4444  info #3B82F6
```

### 3b. Color — DARK palette (accent-as-light, near-black surfaces)
```
primary:    main #8DCFF2  container #004D66  onPrimary #00344A  onContainer #C1E8FF  fixedDim #8DCFF2
secondary:  main #66D9CC  container #005049  onContainer #81F3E5
tertiary:   main #FFB59F  container #6B1800  onContainer #FFDBD0
surface:    main #0E1415  containerLowest #090F10  containerLow #181C1D  container #1C2122  containerHigh #262B2C  containerHighest #313637
onSurface:  main #DFE3E4  variant #BEC8C9
outline:    main #899393  variant #3F4949
error:      main #FFB4AB
status:     success #4ADE80  warning #FFD060  danger #FF8A80  info #60A5FA
```

### 3c. Typography (`typography.*`)
```
h1  30 / 800 / lh38 / ls-0.5
h2  24 / 700 / lh32 / ls-0.3
h3  20 / 700 / lh28 / ls-0.2
body      15 / 400 / lh22
bodyBold  15 / 600 / lh22
caption   13 / 500 / lh18
label     11 / 600 / lh14 / ls0.5   (section labels)
labelWide 11 / 700 / lh14 / ls1.5   (ALL-CAPS eyebrows)
tiny      10 / 600 / lh12 / ls0.5
```
System font. No custom fonts loaded.

### 3d. Spacing / Radius / Shadows
```
spacing:  xs4  sm8  md12  lg16  xl20  2xl24  3xl32  4xl40
radius:   sm8  md12  lg16  xl20  2xl24  3xl32  full9999
shadows:  sm/md/lg  = subtle neutral elevation
          hero      = teal glow (#00445C, opacity .20) — ONLY for primary CTAs / hero cards
          topBar    = faint upward shadow for the bottom bar
```

### 3e. Subject colors (`src/constants/subjects.ts`, `SUBJECT_COLORS`)
Used ONLY for per-subject data viz (calendar, charts, plan blocks, chips):
```
Anatomi #3b82f6 · Fizyoloji-Histoloji #8b5cf6 · Patoloji #ec4899 · Biyokimya #f59e0b
Mikrobiyoloji #10b981 · Dahiliye #06b6d4 · Pediatri #f97316 · Genel Cerrahi #ef4444
Küçük Stajlar #84cc16 · Kadın Doğum #a855f7 · Farmakoloji #14b8a6
```
Canonical order: `TUS_SUBJECT_ORDER`. There are 11 TUS subjects.

### 3f. Theming rules
- **Components must be theme-aware:** read colors from `useThemeColors()` (and
  `useIsDark()` when needed). The static `colors` export is LIGHT-only and is a
  legacy fallback — prefer the hook. SVG stroke/gradient colors must also come
  from the hook (a common miss).
- Theme mode is user-controlled in Settings (Açık / Koyu / Sistem) via
  `useThemeStore` — not just the OS.

---

## 4. Navigation & screen inventory

Expo Router. Bottom tab bar (`app/(tabs)/_layout.tsx`) with rounded floating style.

**Visible tabs** (label → file):
- **Ana Sayfa** → `app/(tabs)/index.tsx` — home dashboard: greeting, inline
  **Kronometre** (StudyTimer), weekly-goal progress ring ("Haftalık Hedef"),
  daily stat row (streak / minutes / tasks / exam countdown), AI-coach message
  preview, upcoming-task card, FAB.
- **Program** → `app/(tabs)/plan.tsx` — the plan area. If no plan: the **plan
  generator** (ModeSelector → WizardFlow or BuilderFlow). If a plan exists:
  **PlanDashboard** with tabs *Genel / Fazlar / Hafta / Dersler*.
- **Analiz** → `app/(tabs)/progress.tsx` — progress & analytics; mastery bars
  (tap → `mastery_detail`), charts.
- **Pratik** → `app/(tabs)/practice.tsx` — question practice. Landing (Kişisel
  Antrenman / Konu Çalış) → subject/subtopic drill → question session with
  reveal + explanation + "Nota Ekle".
- **AI Chat** → `app/(tabs)/chat.tsx` — streaming AI coach chat.

**Hidden tab screens** (`href: null`, reached via navigation):
`qbank_exam`, `exams`, `study`, `inbox`, `settings`, `messages`, `more`,
`mastery_detail`, `two`.

**Root stack screens** (`app/*.tsx`): `chronometer` (full-screen timer),
`calendar`, `notes`, `onboarding`, `preferences`, `modal`, plus `+not-found`.

---

## 5. Key components

- `components/StudyTimer.tsx` — inline chronometer card (subject chips, SVG ring,
  Başla/Duraklat/Bitir). Also standalone at `app/chronometer.tsx`.
- `components/plan-dashboard/` — `PlanDashboard` (tab shell) + `OverviewTab`
  (Genel: progress, stat cards, **MonthCalendar**, phase timeline), `PhasePlanTab`,
  `SampleWeekTab`, `SubjectsTab`, `MonthCalendar` (month grid colored by subject;
  reading=tint, question=full).
- `components/plan-generator/` — `ModeSelector`, `WizardFlow` (4-step guided),
  `BuilderFlow` (full manual: dates, status, level, study days, hours, excluded
  days, subject order, **Ders Derinliği** per-subject reading/question steppers),
  `TurMapper` (maps inputs → tur_number).
- `components/` — `CoachCard`, `PlanList`, `WeeklyChart`, `DailyMiniChart`.

---

## 6. State & data — DO NOT ALTER THESE CONTRACTS

- **Zustand stores** (`src/state/`): `authStore` (token/user), `themeStore`
  (light/dark/system), `timerStore` (live study seconds), `planGeneratorStore`
  (builder inputs incl. `blockDays` overrides), `notificationStore`.
- **API modules** (`src/api/`): `client` (axios; base URL auto-derived from Metro
  host, JWT interceptor, 401 auto-logout), `auth`, `coach` (plan/sessions/stats/
  messages), `qbank`, `notes`, `exams`, `calendar`, `study`, `chat`, `devices`.
- **Data fetching:** React Query. Screens read `useQuery`/`useMutation`; keep query
  keys and mutation shapes intact.

---

## 7. HARD CONSTRAINTS (do not violate)

1. **Presentation layer only.** Never change navigation routes/structure, component
   **prop signatures**, data shapes, API calls, query keys, or store logic.
2. **Tokens only.** All color/type/space/radius/shadow must come from
   `useThemeColors()` / `typography` / `spacing` / `radius` / `shadows`. If a new
   token is genuinely needed, **list it separately as a proposed addition** — don't
   hardcode it inline.
3. **Light + dark both.** Every screen must render correctly in both palettes,
   including SVG colors.
4. **Icons:** MaterialIcons only. **Copy:** Turkish. **Domain:** TUS medical prep.
5. Tap targets ≥ 44px; respect safe areas (`react-native-safe-area-context`) and
   the floating bottom tab bar (screens pad bottom ~100–120px).
6. Redesign **one screen at a time**; do not touch unrelated files.

---

## 8. Quality bar — what "much higher quality" means here

- Stronger visual hierarchy; one clear **primary action** per screen, secondaries
  de-emphasized.
- Consistent spacing rhythm from the scale (don't free-hand margins).
- Purposeful brand-color use; reserve `shadows.hero` for the single hero/CTA.
- Real **empty / loading / error** states, not just the happy path.
- Subtle, tasteful motion/micro-interactions (press, reveal, ring fill).
- Accessible contrast in both themes; legible type; comfortable density.

---

## 9. How to use this pack

1. Paste this file at the top of the design session.
2. Add the target: *"Redesign SCREEN = Ana Sayfa (`app/(tabs)/index.tsx`)."*
3. (Optional) Attach a current screenshot of that screen for visual grounding.
4. Ask for: (a) a visual mockup, (b) a short rationale of what improved, (c) if
   code, a drop-in component using the tokens above + any proposed new tokens
   listed separately.
5. Review, then port intentionally — one screen at a time.
