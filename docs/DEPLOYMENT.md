# Deployment

**Live:** https://fleek-route-economics-lab.pages.dev/, a Cloudflare Pages Git-backed deploy from `main` on the free tier, set up by the repo owner. It opens without sign-in.

Static site. No backend, no secrets, no sign-in.

## Build
```
npm ci
npm run build      # tsc --noEmit && vite build -> dist/
```
Node 22. Output directory: `dist`.

## Cloudflare (free tier)
`wrangler.toml` serves `./dist` as static assets with single-page-app fallback.

Option A, Workers & Pages dashboard: Create, Import a repository, pick `CashpointSoulja/fleek-route-economics-lab`, build command `npm run build`, output directory `dist`, environment variable `NODE_VERSION=22`. No access policy, so the URL opens without sign-in.

Option B, CLI with an authenticated account: `npx wrangler deploy`.

## Verify
Open the URL in a private window: the Fleek logo is top-left, the footer says "Independent concept by Ayomide Ahmed · Not an official Fleek product", and the case picker switches between the three cases. Run the flow check against it with `APP_URL=<url> CHROME_PATH=<chrome> npm run flow`.

## Live check (2026-10-07)
- `curl -L https://fleek-route-economics-lab.pages.dev/` returned HTTP 200 with the title `Route Economics Lab · independent concept for Fleek`.
- `APP_URL=https://fleek-route-economics-lab.pages.dev/ npm run flow`: 50/50 flow checks passed.
