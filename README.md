# Signal & Systems Engineering, LLC.

BUILT IN THE FIELD. ENGINEERED FOR BUSINESS.  
System documentation & technical architecture  
by William A. Atkins | KR4JSQ

Built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build), hosted free on Cloudflare Pages.

## Run it locally

Requires Node.js 22.23.4 or newer (24 recommended; see `.node-version`).

```sh
npm install
npm run dev      # local preview at http://localhost:4321
npm run build    # production build into dist/
```

Always run `npm run build` before pushing. If it fails locally, it will fail on Cloudflare too.

## Deploy on Cloudflare Pages (one-time setup)

1. Cloudflare dashboard > Workers & Pages > Create > Pages > Connect to Git, and pick this repository.
2. Framework preset: Astro. Build command: `npm run build`. Output directory: `dist`.
3. Environment variable: `NODE_VERSION` = `24` (Cloudflare also reads `.node-version`).
4. Save and deploy. Every push to `main` now publishes automatically.
5. Turn on Web Analytics for the Pages project (free, cookie-free).
6. Turn on two-factor login for both GitHub and Cloudflare.

## Where things live

| Path | What it is |
| --- | --- |
| `astro.config.mjs` | Site title, sidebar, fonts, social links |
| `src/styles/custom.css` | Design tokens (dark slate and signal amber) |
| `src/content.config.ts` | Frontmatter fields, statuses and categories |
| `src/components/` | The reusable documentation components |
| `src/content/docs/` | Every page, as `.md` or `.mdx` |
| `src/content/docs/projects/_template.mdx` | Starter for a new project or component page (not published) |
| `public/downloads/` | Config sheets, PDFs and release notes for download cards |

## Adding a page

1. Copy `src/content/docs/projects/_template.mdx` to `src/content/docs/projects/<project>/index.mdx`, or to `<project>/<component>.mdx` for a component page.
2. Fill in the frontmatter and all 12 sections.
3. Run the [publishing checklist](src/content/docs/reference/publishing-checklist.mdx).
4. Add a dated build-log entry in `src/content/docs/log/` and a changelog line on the parent page.

## Rolling back

Every change is a git commit. To undo one, revert it (`git revert <commit>`) and push. In Cloudflare Pages you can also roll back instantly to any earlier deployment from the Deployments tab.
