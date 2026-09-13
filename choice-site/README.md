# Choice One Recruiting copy

Public copy at https://choice.careersteps.net, hosted by the separate `careersteps-choice` Cloudflare static Worker. The CareerSteps main site and admin Worker are unchanged.

Six pages copied from the public Choice One Recruiting website on September 13, 2026. Original HTML, styles, images, fonts, and runtime scripts are retained. Broken source `.html` links were recovered from the corresponding directory URLs and are served at the linked `.html` addresses here.

## External dependencies

- The original 28.9 MB background video continues to stream from its original CDN because it exceeds the static asset upload limit.
- Careers retains the original Exelare job board embed; Client Application retains its Cognito Forms embed.
- The General Application Form retains the original provider's form and upload implementation. Submission delivery is unverified and requires the original provider's backend/domain configuration. Do not assume applications are being delivered without a real provider-side test.
- Some source widget stylesheets and legacy SVG font fallbacks returned 403 from the original CDN. Their original URLs are preserved; supported font formats were copied.
- Some runtime features still depend on the original website provider. This is a public-site copy, not an export of its backend or editing system.

## Refresh, validate, deploy

From this directory, `node mirror.mjs` downloads public pages/assets into `dist` and records their origins in `mirror-report.json`. Downloads are cached locally in ignored `source-cache`.

Run `node validate.mjs`. From the repository root deploy with `node worker/node_modules/wrangler/bin/wrangler.js deploy --config choice-site/wrangler.jsonc` after review and authorization.
