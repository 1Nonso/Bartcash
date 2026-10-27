# Bartcash

**Swap what you have for what you want.** Bartcash is a mobile barter marketplace: list an item, say what you'd take for it, and trade item-for-item, with an optional cash top-up when the values don't line up.

I'm building Bartcash as a startup, starting in Nigeria, where a lot of value sits in things people own but no longer use, and cash is often the scarce part of a trade. I built the core marketplace in September 2026. When I heard about the Qloo hackathon I entered it to add taste intelligence to the matching, and to look for funding to take Bartcash further.

> **Try it:** [Download the Android app (APK)](https://github.com/1Nonso/Bartcash/releases/download/v1.0.1-hackathon/bartcash-1.0.1.apk) ([release notes](https://github.com/1Nonso/Bartcash/releases/tag/v1.0.1-hackathon)) · Demo logins: on the Devpost page (testing instructions)
>
> Start with a demo account: it already has listings, matches, people with similar taste and an offer waiting. Then create your own account and list something to see Scout work from scratch. The verification code email may land in your **spam** folder.
>
> **About valuations:** the Automated Valuation runs on a free plan with a daily limit. If many listings are valued on the same day, a new listing's valuation may say it couldn't be completed; try again later (the owner can retry from the listing page). Matching and the rest of the app keep working; on such a day, what-to-ask-for suggestions show "Popular choices" instead of brand-based ones.

---

## What Qloo powers

Barter has a discovery problem: you need someone who has what you want **and** wants what you have. Bartcash uses [Qloo](https://qloo.com)'s taste intelligence to close that gap.

| Feature | What it does | How Qloo is used |
|---|---|---|
| **What would you take?** | When you list an item, Bartcash suggests five categories to ask for in exchange, with a reason ("Fans of Canon also like Sony") | The listing's brand is recognised and looked up in Qloo; its related brands (insights) are mapped onto Bartcash's categories and ranked |
| **Scout: matches for each listing** | Home shows the best listings to swap with, labelled Strong / Good / Possible, with "Why this matches" | Ranking combines your wants, the other person's wants, and **taste affinity**: one Qloo insights call scores candidate brands against your listing's brand and your interests |
| **Taste profile** | Add brands, artists, films, TV, games, books and podcasts you like, with suggestions before you type | Qloo search across entity types; suggestions from related brands, "picked for your taste" insights and popular picks |
| **People like you** | People whose taste overlaps with yours, what you have in common, and their listings that fit you | Overlap of saved Qloo entities and their tags; previews ranked by Qloo brand relations |
| **Draft an offer with Scout** | One tap drafts a trade proposal: the item to offer, a fair cash top-up and a friendly opening message | Mentions an interest you both share; the top-up comes from the two automated valuations |

Scout only suggests: you review and send every offer yourself.

**Built to run on a budget.** Qloo responses are cached, calls are paced per process, background work stops when the monthly budget runs low, and every Qloo feature sits behind one flag (`QLOO_ENABLED`). With the flag off, the Qloo features are hidden and Bartcash behaves as it did before Qloo: browse and search, with no matching.

## What changed after Sep 30, 2026

The marketplace (accounts, listings with photos, automated valuation, trades with offers and counter-offers, chat, ratings, disputes) existed before the hackathon. Since Sep 30 I added:

- **Qloo integration:** client with caching, pacing, retries, circuit breaker and budget guard; brand resolution for listings; want suggestions; the matching engine (wants, taste affinity, reciprocity, owner compatibility); taste profiles and suggestions; taste compatibility between people; Scout's Draft an offer
- **New screens:** Home (Matches / People like you), Discover, All matches, Taste profile, Add interests, wants picker on Create / Edit Listing, "Why this matches" on Listing Detail, What you have in common on profiles
- **App improvements:** first-time tours and in-app guides, a floating tab bar, an email verification screen, listing photo editing, Inbox fixes (live status, turn indicator, cash and top-ups), and many smaller fixes

## How it works

```
Expo app (React Native, Android)
        │  HTTPS / JSON
Express API (TypeScript) ──► PostgreSQL (Prisma)
        │                        ▲
        └─ pg-boss job queue ────┘
              │
              ├─ valuation     (Groq: reads the cover photo, returns a USD range)
              ├─ item_taste    (Groq brand extraction → Qloo search + insights → want suggestions)
              ├─ match_refresh (scores candidates, one Qloo insights call per listing)
              └─ taste_compat  (person-to-person overlap, no Qloo call)
```

- **App:** Expo SDK 57, Expo Router, axios. `frontend/`
- **API and worker:** Express 5, TypeScript, Prisma 7, pg-boss, Zod. The worker can run in the API process (`RUN_WORKER=true`) or on its own (`npm run worker`). `backend/`
- **Services:** PostgreSQL (Supabase in production), Cloudflare R2 for images, Groq, Qloo, SendLibs for email
- **Hosting:** Render (`render.yaml`)

## Run it locally

You need Node 24, PostgreSQL, and keys for R2, Groq and SendLibs (Qloo is optional: leave `QLOO_ENABLED=false`).

### API

```bash
cd backend
npm ci
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET and the service keys
npx prisma generate
npx prisma migrate deploy     # creates the tables
npm run seed                  # categories
npm run dev                   # API on http://localhost:8000
npm run worker                # in a second terminal (or set RUN_WORKER=true)
```

Check it: `curl http://localhost:8000/health` returns `{"ok":true}`.

### App

```bash
cd frontend
npm ci
cp .env.example .env          # EXPO_PUBLIC_API_BASE_URL: your computer's LAN IP on a phone
npx expo start                # scan the QR code with Expo Go, or press a for an emulator
```

### Tests

The scoring, matching, taste and Scout logic is covered by fixture scripts that need no API keys or network calls:

```bash
cd backend
for f in match compat scout taste wants want-suggestions backfill groq-limiter valuation-failure; do
  npx tsx src/scripts/$f-fixtures.ts
done
```

## License

[GPL-3.0](LICENSE) © 2026 Othniel Chukwuani
