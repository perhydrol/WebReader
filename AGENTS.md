# AGENTS.md

## Scope And Parent Rules

This file applies to the WebReader repository. Cross-project strategy, Git/main rules, and the default desktop validation target come from `../070315-site/AGENTS.md`. Read that file before cross-project work or before changing this file.

`OWNER-MAINTAINED` sections record product policy and must not be changed without an explicit user decision. `AGENT-MAINTAINED` sections record verified project facts and must be updated with the code or workflow that changes them.

## OWNER-MAINTAINED: Product Boundary

- WebReader is a private-by-default, local-first browser reader.
- The interface is bilingual Chinese/English and defaults to Chinese; user language choice is kept in the browser.
- Imported book bytes, covers, reading history, annotations, search indexes, and locally reflowed paper text must not be uploaded to GitHub or any remote service. Ordinary reading and paper reflow never send extracted text. WebReader currently has no content-translation UI, provider runtime, development proxy, or standalone translation entry; existing local translation records may remain only for IndexedDB compatibility and must not be read or resumed by the application.
- Feedback directs users to this repository’s GitHub Issues through an explicit external link. Never collect feedback text or attach book files, names, library metadata, reading history, or fingerprints.
- Text-layer PDFs may be analyzed locally into stable source blocks, shown as a deterministic single-column article or a page-by-page proof view beside the authoritative PDF Canvas, and mapped back to PDF.js TextLayer items and source regions. OCR, semantic rewriting, model-assisted ordering, and silent synthesis of missing content are not supported.
- GitHub Pages hosts only the static application. GitHub Actions is CI/CD, not an application server or persistent VPS.
- The first supported formats are DRM-free EPUB, PDF, and TXT. Markdown import and rendering are not supported. Legacy Markdown rows stored as TXT remain visible, are blocked from opening by fileName/mediaType at the library entry, and stay deletable without migration or silent conversion. DRM circumvention is out of scope.
- Accounts, cloud storage, telemetry, analytics, public sharing, OCR, server-side conversion, and third-party book metadata requests are not added without explicit approval as a major change.
- Default development and acceptance target is desktop landscape around 1440x900. Existing responsive and touch behavior must remain basically usable.
- Small, bounded fixes can go directly to `main` after minimum validation. Major workflow, storage protocol, security boundary, format, framework, or deployment changes require a scope/risk proposal and user confirmation first.

## Workflow

1. Run `git status --short --branch` and preserve existing local changes and untracked material.
2. Use Node 24 or newer, pnpm (as pinned in `package.json`), and the committed `pnpm-lock.yaml`.
3. Never add real books, private documents, screenshots, browser profiles, IndexedDB dumps, generated build output, or test output to Git.
4. Use synthetic fixtures or clearly redistributable public-domain fixtures only. Record provenance for any non-synthetic fixture.
5. Stage explicit paths. Inspect `git diff --cached` and the staged file list before every commit.
6. A push to `main` publishes production through GitHub Pages. Run the minimum validation before pushing.

## AGENT-MAINTAINED: Project Facts

<!-- AGENT-MAINTAINED:START project-facts -->

### Architecture

- `src/App.tsx`: library and reader-shell coordination, import/delete flows, reader panels, preferences, shortcuts, and format dispatch.
- `src/components/`: reading settings, recursive outline panels, the cross-format in-book search panel, and the root interface recovery boundary.
- `src/readers/`: isolated EPUB, PDF, and text rendering adapters.
- `src/lib/preferences.ts`: validated migration from legacy reader preferences to the versioned preference model.
- `src/lib/epubStyles.ts`: paired EPUB theme colors for body text, text surfaces, and code surfaces without recoloring publication media or removing CSS background images.
- `src/lib/textDocument.ts`: bounded TXT source model with paragraph ranges, 4000-unit display fragments, 48×1024-unit chapters, automatic outline, and visible-offset clamping.
- `src/lib/textBook.ts`: escaped chapter HTML, lazy blob-URL sections, and revocation for the local foliate paginator.
- `src/lib/textDom.ts`: source-attribute DOM mapping, precise local ranges, and search-mark wrapping/cleanup.
- `src/lib/textDisplay.ts`: shared TXT font stacks, content widths, and theme colors for both views.
- `src/lib/textPagination.ts`: source-range binary lookup and gap clamping used by the TXT model.
- `src/readers/TextReader.tsx`: TXT decode, progress/search controller, and bounded scroll/paged mode dispatch.
- `src/readers/TextScrollView.tsx`: Virtuoso window with per-fragment source restore, viewport progress, and highlighting.
- `src/readers/TextPagedView.tsx`: foliate paginator with lazy safe chapters, queued navigation, and per-chapter source ranges.
- `src/lib/readerSearch.ts` and `src/lib/pdfSearch.ts`: bounded, cancellable in-memory matching, excerpts, PDF text-item joining, and source-fragment mapping.
- `src/lib/pdfText.ts`: bounded local PDF text-layer normalization, line/column ordering, semantic blocks, stable IDs, repeated-margin removal, conservative page-quality gates, and source geometry provenance.
- `src/readers/PdfReader.tsx`: authoritative PDF rendering plus the local reflowed-article and page-by-page proof views.
- `src/lib/pdfOutline.ts`: local PDF outline destination resolution.
- `src/lib/pdfLayout.ts`: bounded continuous-PDF page windows, real page geometry, and stable page-relative scroll restoration.
- `src/lib/wheelPager.ts`: one-turn-per-gesture mouse-wheel pagination with boundary eligibility for scrollable pages.
- `src/lib/formats.ts`: file size, signature, extension, and MIME validation.
- `src/lib/epubValidation.ts`: bounded EPUB ZIP/container preflight for entry paths, duplicates, encryption, expanded sizes, compression ratios, and required package metadata.
- `src/lib/coalescingWriteQueue.ts`: serial, per-key coalescing for progress and preference writes, with explicit flush points on reader exit and page lifecycle events.
- `src/lib/fingerprint.ts`: bounded content fingerprinting used for local duplicate detection.
- `src/lib/storage.ts`: Dexie/IndexedDB repository for book metadata, source Blob, settings, locators, and legacy translation-store declarations retained only to open and clean up existing v3/v4 databases without losing books.
- `src/lib/i18n.ts`: Chinese/English interface strings and language selection.
- `src/types/`: stable publication, locator, preference, and third-party adapter types.
- `public/`: committed application icons and public static assets.
- `dist/`: generated Vite/Pages artifact; never edit or commit.

The stack is React, TypeScript, Vite, Konsta UI (explicit iOS theme), Tailwind CSS, Dexie, foliate-js, react-virtuoso, PDF.js, Lucide, Vitest, Playwright, Oxlint, Stylelint, and vite-plugin-pwa. LibraryView and AppSettings own shelf presentation; ReaderToolbar, ReaderSheet and useReaderChrome own floating controls and modal lifecycle. TXT emits session-scoped pointer/selection/tap semantics from its scroller and loaded chapter documents. Chrome visibility and overlay panels never change reader geometry or mount identity; EPUB/PDF keep their main controls visible. Reader appearance follows the system by default through the normalized followSystemTheme preference; choosing a concrete background opts out without changing the IndexedDB schema. EPUB, PDF, and text use separate reader adapters, capabilities, outline sources, locator types, and source-aware search implementations behind one reader search contract. Search queries, excerpts, result maps, and PDF text-item caches stay in memory for the active reader, are bounded and cancellable, and are never persisted or uploaded. EPUB cleanup is idempotent so async initialization and React unmount cannot release the same renderer twice; bounded ZIP/container preflight rejects encrypted, malformed, path-unsafe, duplicate, or excessive expanded EPUB resources before import. The root error boundary keeps a local recovery path if a reader still fails unexpectedly. Reflowable EPUB/text support local typography and background preferences; fixed-layout EPUB/PDF do not expose typography controls. TXT uses one source model with 4000-unit display fragments and 48×1024-unit chapters. Scroll mode mounts only a Virtuoso window plus limited pre-read; paged mode renders one escaped chapter document in the local foliate paginator at a time. Both map visible DOM back to source UTF-16 offsets, clamp gap positions to visible text, and persist source offsets across typography, sidebar, viewport, mode, and reload changes. Markdown import and rendering are removed; legacy Markdown rows stored as TXT remain visible, blocked from opening, and deletable without migration. TXT markup, scripts, links, and images stay literal text and never execute or load remote resources. Progress and preferences use serial, coalesced IndexedDB writes and flush on reader exit, page hiding, and page lifecycle exit. The active document's paged/scroll mode is changed from the reader toolbar and remembered per document; fixed-layout EPUB disables that control. PDF Canvas remains the authoritative visual source and has an official PDF.js TextLayer overlay for selection. A PDF document is parsed once per opened file and reused across paged, continuous, article, and proof views; page Canvas, TextLayer, continuous slots, and proof previews report failures locally without replacing other readable pages. Bounded local analysis preserves text-item provenance, stable source blocks, deterministic reading order, repeated-margin removal, page-quality diagnostics, and page-relative locators. PDF search independently scans the PDF.js text layer and maps the selected match back to source geometry without requiring or changing paper reflow. The PDF tool exposes a continuous single-column article view and a page-by-page proof view beside original page previews. The application HTML declares `viewport-fit=cover` and iOS home-screen default status-bar mode, while App synchronizes the root canvas and browser theme color with the active appearance; the reader shell consumes browser-reported safe-area insets once, while the shelf and fixed overlays apply their own insets. Content-translation code, provider configuration, remote execution, development proxying, and production translation entries are absent; only the existing Dexie v3/v4 store names remain for non-destructive database compatibility and cascading cleanup when a book is deleted.

### Commands

- Install: `pnpm install --frozen-lockfile`
- Develop: `pnpm run dev`
- Unit tests: `pnpm test`
- Watch tests: `pnpm run test:watch`
- Lint: `pnpm run lint`
- Type-check and build: `pnpm run build`
- Full minimum validation: `pnpm run check`
- Desktop production E2E: `pnpm run test:e2e` (requires Chrome; install with `pnpm exec playwright install chrome` when unavailable)
- Preview production build: `pnpm run preview`

File import, IndexedDB migration, PWA, EPUB/PDF rendering, worker URL, CSP, page navigation, or visual changes also require `pnpm run test:e2e` plus a focused desktop browser check when the affected behavior is not covered by the synthetic suite.

### Deployment

`main` is built and published by GitHub Actions to GitHub Pages. The public URL is `https://perhydrol.github.io/WebReader/`. GitHub Actions runs `pnpm run check` only; browser E2E is a local validation command. Vite uses relative asset paths so workers, manifest, icons, and application chunks resolve beneath the Pages repository path.

The service worker caches only the application shell. Explicit optional-font downloads use a separate application-managed Cache Storage cache containing only verified public font bytes; see [font resource ownership](src/lib/optionalFont.md). User book data belongs in IndexedDB and must never be copied into Cache Storage, a Pages artifact, Actions artifact, log, or repository file.

<!-- AGENT-MAINTAINED:END project-facts -->

## Storage And Privacy Invariants

- An imported source Blob and its `BookRecord` are written in one IndexedDB transaction.
- Legacy translation stores from IndexedDB versions 3 and 4 remain declared only so existing libraries open without a destructive migration. Application code must not expose APIs that create, read, or resume those records; deleting a parent book still removes its legacy records in the same transaction.
- `BookRecord.id` is a random local identifier. The fingerprint is used only inside this browser for duplicate detection; never expose cross-user deduplication signals.
- Deleting a book removes both metadata and source Blob. It never modifies the original file selected from the user's filesystem.
- A locator is format-specific: EPUB CFI, PDF page index, or text progression. Do not replace it with a generic rendered page number.
- IndexedDB schema changes require an ordered Dexie migration and tests for reading existing data. Never silently clear a user's library to resolve a migration error.
- PWA installation and persistent-storage permission are not backups. Storage UI must describe browser-clearing risk accurately.
- Object URLs, PDF documents, render tasks, ebook renderers, workers, and large buffers must be released when replaced or unmounted.

## File And Rendering Safety

- Do not trust extension or client MIME alone. Keep signature/container checks and explicit file/resource limits.
- EPUB and other archive formats are untrusted active inputs. Keep the restrictive CSP, block scripted publication content, forms, remote resource requests, and automatic external navigation.
- PDF.js must run parsing in its worker. Keep Canvas as the authoritative rendering source and do not create or import PDF scripting managers, sandboxes, or document JavaScript actions. The official PDF.js TextLayer may overlay Canvas solely for local selection and source-item mapping. Bounded local reflow may use `getTextContent()` but must not transmit it, infer missing text, or hide rejected pages.
- Do not add remote fonts, runtime CDNs, metadata APIs, cover fetches, link prefetching, content-translation providers, or any ordinary-reader network destination without a new explicit product decision.
- Feedback uses an explicit GitHub Issues navigation link with no prefilled local context. Explain that GitHub requires connectivity and issue contents may be public.
- A new format needs its own input validation, adapter, locator semantics, compatibility statement, malformed fixtures, and resource limits.
- "Supported" means the project defines readable output, navigation, progress stability, failure behavior, and cleanup. Opening one sample is not sufficient.

## GitHub And Pages Safety

- Workflows use least privilege. Checks need `contents: read`; Pages deploy needs only `contents: read`, `pages: write`, and `id-token: write`.
- Pull-request jobs must never gain deployment secrets or write permissions. Do not execute untrusted PR code in a privileged deployment job.
- GitHub-hosted runners and Codespaces are not production servers. Do not add keepalive loops, tunnels, scheduled server restarts, or similar workarounds.
- Keep all URLs, workers, dynamic imports, manifest paths, service-worker scope, and navigation compatible with the `/WebReader/` Pages subpath.
- Service-worker updates must not discard unsaved reading state or mix an incompatible application bundle with a new IndexedDB schema.

## Documentation Maintenance

Agents may update verified `AGENT-MAINTAINED` facts. Changes to repository name/path, public URL, minimum validation, runtime, deployment, privacy boundary, or supported formats must also update `../070315-site/AGENTS.md`. Public features, formats, data behavior, installation, or deployment changes also update README. Do not record temporary progress, commit hashes, deployment IDs, secrets, or private sample details in AGENTS files.
