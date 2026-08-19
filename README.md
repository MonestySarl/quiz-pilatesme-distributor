# quiz-pilatesme-distributor

Distributor qualification quiz for Pilates&Me — hosted at `quiz.pilatesme.com/distributor`.

## Stack
- Vanilla HTML/CSS/JS, deployed to Vercel
- Backend: Supabase edge fn `distributor-submit` writes to `distributor_applications` table (CRM)
- Calendly embed for booking a call with the distributor commercial

## Structure
- `distributor/index.html` — landing page
- `distributor/quiz.html` — 8-step SPA quiz (single file, all steps inline)
- `assets/pmb-tracker.js` — visitor tracking (funnel = `distributor`)
- `vercel.json` — routing

## Flow (8 steps)
1. Country (multi-select with search)
2. Business type (multi-select)
3. Product interest (single: machines / accessories / both)
4. Business model (single: stock / dropship / hybrid / not sure)
5. Volume/month (1 or 2 gauges based on step 3)
6. Annual revenue (single)
7. Timeline (single)
8. Contact form + Calendly

## i18n
English only for now. Structure ready for FR/AR additions via `assets/i18n/`.

## URL structure
- `quiz.pilatesme.com/` → redirect to `/distributor`
- `quiz.pilatesme.com/distributor` → landing
- `quiz.pilatesme.com/distributor/quiz` → SPA quiz
