# Brand sheet (mirrored from joinfleek.com)

Captured 2026-10-07 from the live public site `https://joinfleek.com` (desktop 1366x900 and mobile 390x844) and its public stylesheets. This app is an independent concept by Ayomide Ahmed and is **not an official Fleek product**; the mark is used only to show which company the concept is addressed to.

## Logo
- File: `public/brand/fleek-logo.webp`, 549x175 RGBA, the black starburst + FLEEK wordmark served by the site at `/_next/static/media/black_logo_transparent_background.1ecc84e6.webp`. Used unmodified (no recolouring, no redraw).
- At capture time the site header showed a seasonal campaign lockup ("FLEEKY FRIDAY", `fleeky_white_bg_logo.png`). The concept uses the permanent black wordmark, not the campaign lockup.
- Placement: top-left of the app header, 28 px tall on desktop, 22 px on mobile, on white.

## Colour (CSS custom properties found on the site, `--cf-*`)
| Token | Hex | Site use | Concept use |
|---|---|---|---|
| `--cf-black` | `#0f0f0f` | text, Login pill | text, primary buttons, header rules |
| `--cf-white` | `#ffffff` | header, cards | surfaces |
| `--cf-cream` | `#f6f1e7` | "As seen in" band, featured sections | page sections, assumption grid band |
| `--cf-yellow` | `#f8c642` | "Sign Up" button, hero highlight text | primary accent, active tab, proceed badge |
| `--cf-yellow-dark` | `#e6b52f` | yellow hover | hover |
| `--cf-orange` | `#f25c2a` | accents | stress/hold state |
| `--cf-blue` | `#0d2bff` | links/accents | focus ring, links |
| `--cf-gray-100` | `#f5f5f5` | image wells | table stripes |
| `--cf-gray-200` | `#eaecf0` | borders | borders |
| `--cf-gray-500` | `#98a2b3` | muted text | placeholders |
| `--cf-gray-700` | `#475467` | secondary text | secondary text |
| sale red | `#f04438` | sale pill | blocked / kill state |

## Type
- Montserrat throughout (site self-hosts `montserrat-latin-*.woff2`, weights 100-900). The concept bundles Montserrat from the open-source `@fontsource/montserrat` package (SIL OFL), weights 400-800.
- Observed sizes: hero H1 52 px / 700 (28 px mobile), section H2 28 px / 700 (20-22 px mobile), nav 14 px / 700, body 16 px.
- Hero pattern: white bold headline with one phrase in yellow (`best inventory`). The concept reuses this for the page title (one phrase in yellow on black band).

## UI patterns
- Header: white, 1 px `#eaecf0` bottom border, logo left, text nav with icons, outlined black search field (2 px border, 4 px radius), yellow "Sign Up" pill and black "Login" pill (4-6 px radius, 13 px bold).
- Top promo strip: light grey bar with centred bold text. Concept: a disclaimer strip in the same position.
- Cards: 12 px radius, white on cream, thin grey border, bold 14 px titles.
- Labels: small 11 px bold uppercase eyebrow with 1.5 px letter-spacing (`AS SEEN IN`, featured eyebrow in yellow).
- Spacing scale: 8 / 16 / 24 / 32 / 48 / 64 / 96 px (`--cf-sp-*`), max content width 1280 px.
- Mobile: hamburger + logo + icons, full-width yellow CTA, horizontal scroll rows.

## What we deliberately do not copy
Product photography, partner/press logos, the QR code, app store badges, campaign art and any marketplace/checkout actions. The concept has no buy, book, order, outreach or payment controls.
