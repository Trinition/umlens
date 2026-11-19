# UMLens Project Context & Guardrails

## Product Vision
- **UMLens** (formerly SeqLens) is a local-first, cross-platform PWA diagram explorer for PlantUML (`.puml`) and Mermaid (`.mmd`), designed to scale cleanly to additional UML diagram types (class, state, component, etc.).
- Core UX priorities: OS-level file associations via the PWA File Handling API, instant drag-and-drop, and global clipboard paste support.

## Architecture & Build Constraints (Do Not Break)
- **Hosting:** Deployed automatically to GitHub Pages (`https://trinition.github.io/umlens/`) via `.github/workflows/deploy.yml` on every push to `main`.
- **Vite Base Path:** Keep `base: '/umlens/'` in `vite.config.js` (or environment-conditional so AI Studio preview still works while production builds keep `/umlens/`). Do not break relative asset paths.
- **PWA & Icons:** Keep the PWA manifest, service worker, File Handling API `file_handlers` config (`.puml`, `.mmd`), and the transparent icons in `public/` (`icon.svg`, `icon-192.png`, `icon-512.png`). Do not overwrite `public/` icons with opaque placeholders.
- **Tooling:** Uses Vite, React, Tailwind CSS, and `oxlint`. Keep changes compatible with `npm ci && npm run build` in GitHub Actions.
