# Benzi George — five website review concepts

## Partner logo assets

All five Partnerships pages use proportionally scaled, locally served partner logos on light backgrounds for legibility across themes. InterVarsity's unmodified SVG was downloaded from `https://intervarsity.org/themes/custom/ivnational/logo.svg`, the logo used by its official website. Hope Sojourns uses the existing `A_WebDev/HopeSojourns/assets/hope-sojourns-logo.png`; Career Steps uses this project's existing `assets/career-steps-logo.png`. Logos remain the property of their respective organizations.

Five complete concepts for **https://intervarsity.careersteps.net**. Each contains Home, About, Consulting, Ministry, Partnerships, and Connect. The design dropdown preserves the current page. `noindex,nofollow` and a robots exclusion are intentional while Benzi reviews the concepts.

## Preview

Serve this directory using a local static server. Page content works without JavaScript or third-party fonts; the design dropdown uses `assets/concepts.js`. The local preview uses port 8766. Run `python tools/build_concepts.py` from this directory to regenerate all 30 pages.

## Direction

Personal umbrella brand: **Benzi George — Leadership with Purpose**. Consulting and InterVarsity ministry share his story but have distinct sections, contact addresses, and calls to action. First-person copy is proposed editorial wording grounded in his materials and should be reviewed by Benzi.

Josh Beyond Borders was the requested inspiration: personal storytelling, prominent authentic photography, warm materials, meaningful section progression, and a clear invitation to participate. This implementation uses original copy, an original vector mark, a forest/ivory/brass palette, serif-led editorial typography, a portrait-led composition, and service-focused navigation. No Josh code, images, fonts, or logo assets were copied.

Logo concept: **Coming Alongside**. Two complementary arches come together around a central cross: partnership, shared direction, and faith. `assets/logo-mark.svg` is an editable vector first concept, used with a name wordmark on the page. It is not an InterVarsity logo or an approved final identity.

## Sources reviewed — November 6, 2026

- Benzi's November 4 email, **Great Catching Up**, message ID `1a1a77ea47ee3523`, including the attached 11-page **Benzi George - Consultant-5.pdf**. One attachment contains several flyers; no additional Benzi attachments were present in the email found.
- https://givetoiv.org/benzigeorge redirects to https://give.intervarsity.org/?g=15489&f=o. Read the actual Benzi profile in the downloaded page, including his healthcare-to-campus-ministry story and regional/national work.
- https://www.joshbeyondborders.org/ and the existing local Josh project, read only for design reference.
- Portrait: original embedded JPEG extracted from page 1 of Benzi's supplied PDF, preserved in full and displayed proportionally.
- Contact, LinkedIn, consulting offerings, and engagement types: supplied PDF. Ministry contact and scheduling URL: email signature.

Original research downloads and extracted content are under ignored `research/`; do not deploy that directory. `tools/prepare_deploy.py` rebuilds and validates all pages, then stages an explicit allowlist of public pages, assets, robots, and headers into ignored `dist/`. Source tools, documentation, research, and deployment configuration are excluded from the deployment.

## Decisions for the next round

1. **Existing consulting identity:** the flyers already show **Sixteen·Nine Advisory Group**, also visible in Benzi's public LinkedIn activity. Confirm whether the personal brand replaces, complements, or links to that identity before finalizing a logo.
2. **Domain:** use the requested `intervarsity.careersteps.net` for this concept. The current CareerSteps site uses GitHub Pages. This review site uses its own Cloudflare static-assets Worker, `careersteps-intervarsity`, and a custom domain configured in `wrangler.jsonc`; the root CareerSteps `CNAME` and admin Worker are unchanged. Benzi also mentions an already-secured `.org` in his email without naming it; confirm the address for future use.
3. **Role wording:** the email says National Associate ED/COS for Field Ministries; the giving profile says National Associate Chief of Staff and Senior Field Director. The draft uses broader national leadership wording pending confirmation of his preferred public title.
4. **Pricing:** PDF pages 7 and 9–10 conflict (for example, leadership coaching $280 versus $250, executive coaching $380 versus $350). Discounts and retreat rates also differ. Omit public prices until Benzi confirms a single rate sheet.
5. **Scheduling:** the supplied booking address is an InterVarsity account. Keep it for this initial concept, but confirm whether consulting should get a separate calendar.
6. **Audience:** the user described secular fractional consulting, while much of the PDF uses explicitly Christian language. This draft makes services legible across organizations while stating Benzi's faith openly. Confirm how strongly he wants faith language in each service area.
7. Gather approved current bio, ministry/team photos, examples of engagements and permissions for any future testimonials. Do not invent clients, outcomes, credentials, or endorsements.

## Release

Brent explicitly authorized committing, pushing, and deploying all five concepts on November 6, 2026 for sharing with Benzi. This is a public review deployment, retaining the concept selector and noindex protection. Naming and copy decisions above remain for later refinement.

Build/check from repository root:

```text
python intervarsity/tools/prepare_deploy.py
node --check intervarsity/assets/concepts.js
node worker/node_modules/wrangler/bin/wrangler.js deploy --config intervarsity/wrangler.jsonc --dry-run
```

After explicit release approval, deploy using the same Wrangler command without `--dry-run`. The account and single custom domain are pinned in the config. Existing CareerSteps and admin deployments remain independent. Browser automation was unavailable for visual review; structural validation, image validation, link checks, local HTTP checks, deployment dry run, and live HTTP verification are the available release checks.
