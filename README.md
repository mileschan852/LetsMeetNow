# HKMOD & LMN Dating Apps

Shared-core monorepo for two Telegram Mini App dating platforms.

## Apps

| App | Description | Port |
|-----|-------------|------|
| `apps/hkmod` | Hong Kong Members Only — gay dating with role/preferences matching | 3000 |
| `apps/lmn` | Let's Meet Now — general dating with zodiac/gender/seeking matching | 3001 |

## Shared Core (`packages/core`)

- `i18n.ts` — translations (EN/TC/SC/RU) with app-specific overlays
- `supabase.ts` — REST client for shared Supabase project
- `storage.ts` — Telegram CloudStorage + localStorage fallback

## Setup

```bash
# HKMOD
cd apps/hkmod
npm install
npm run dev      # localhost:3000
npm run build    # dist/

# LMN
cd apps/lmn
npm install
npm run dev      # localhost:3001
npm run build    # dist/
```

## Environment Variables

Copy `.env.example` in each app and fill in:

```
VITE_SUPABASE_URL=https://fngcjkclxxodjaiqkfkm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Deployment

GitHub Actions auto-deploy to GitHub Pages on push to `main`.

## Webhook Server

Each app needs a corresponding Telegram bot webhook handler for:
- Stars payment processing
- Admin commands
- Raffle management

See `webhook-server/` for the cleaned handler code.
