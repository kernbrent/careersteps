# Benzi George — seven website review concepts

## Partner logo assets

All seven Partnerships pages use proportionally scaled, locally served partner logos on light backgrounds for legibility across themes. InterVarsity's unmodified SVG was downloaded from `https://intervarsity.org/themes/custom/ivnational/logo.svg`, the logo used by its official website. Hope Sojourns uses the existing `A_WebDev/HopeSojourns/assets/hope-sojourns-logo.png`; Career Steps uses this project's existing `assets/career-steps-logo.png`. Logos remain the property of their respective organizations.

Seven complete concepts for **https://intervarsity.careersteps.net**. Each contains Home, About, Consulting, Ministry, Partnerships, and Connect. The design dropdown preserves the current page. `noindex,nofollow` and a robots exclusion are intentional while Benzi reviews the concepts.

## Preview

Serve this directory using a local static server. Page content works without JavaScript or third-party fonts; the design dropdown uses `assets/concepts.js`. The local preview uses port 8766. Run `python tools/build_concepts.py` from this directory to regenerate all 42 pages.

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

After explicit release approval, deploy using the same Wrangler command without `--dry-run`. The account and single custom domain are pinned in the config. Existing CareerSteps and admin deployments remain independent. The original five concepts were released with structural, asset, link, local HTTP, dry-run, and live HTTP verification. Version 06 was additionally reviewed in the browser at desktop (1280px) and mobile (390px) widths, with color persistence, image loading, horizontal overflow, and page-preserving concept switching checked.

## Version 06 — Purpose in Practice (November 12, 2026)

Based on Benzi's November 10 reply, message `1a1c5e6b4117b6d4`. He prefers Option 4's approachable feel, wants to explore other colors, and requested a layout related to Josh Beyond Borders and https://linsondaniel.com/. The sixth concept uses a framed, photo-led hero; role-based links for executive partnership, coaching, and ministry; a personal story; ministry timeline; service sections; partner logos; and a giving invitation. No reference-site biography, testimonials, photos, or unrelated personal roles were reused.

Three palette options (Ocean & Copper, Pine & Sand, Ink & Gold) are available on all six pages of version 06; the choice persists within the browser session. The original five designs receive only the sixth dropdown option.

Benzi's signature giving URL, https://givetoiv.org/benzigeorge, appears in every version 06 header and in dedicated homepage, ministry, and contact giving sections. It leads to InterVarsity for gifts; consulting remains separate. Brent approved committing, pushing, and deploying versions 06 and 07 on November 12, 2026.

## Version 07 — After Hours (November 12, 2026)

Requested as a separate version using the very dark palette of Josh Beyond Borders. Reuses version 06's story-led structure and content, with a dedicated charcoal, warm parchment, dark rust, and copper design across all six pages. The original portrait is displayed proportionally at a smaller size with rounded corners, an offset outline, and a soft frame; its source image is unchanged. Official partner logos retain their original colors and light surfaces for legibility. The InterVarsity giving URL remains in the header and giving sections.

Version 06's three selectable palettes are unchanged. Version 07 has a fixed dark palette. All seven concepts are available through the page-preserving dropdown. All 42 pages pass structural/link validation; version 07 additionally passes desktop and 390px mobile browser checks, image loading, giving-link checks, and switching to/from version 06. Brent approved release of versions 06 and 07 on November 12, 2026, including the subsequent site-wide typography and portrait presentation refinements.

## November 12 review refinements

Option 4’s Trebuchet heading family and a smaller scale apply throughout every page of concepts 06 and 07, including role links and display text. Both concepts use a smaller framed portrait with more breathing room. Browser checks verified desktop and mobile layouts, heading consistency on all 12 pages, intact image proportions, giving links, and seven-way concept navigation.
