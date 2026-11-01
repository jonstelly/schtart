# Schtart

Schtart is a personal web-app start page built with SvelteKit 3, Svelte 5, and TypeScript. Sports will be one part of the experience, alongside other useful tabs and tools.

```sh
pnpm install
pnpm dev        # dev server
pnpm test       # unit tests
pnpm check      # types + svelte-check
pnpm build      # production build into ./build
```

## Docker

```sh
docker build -t schtart .
docker run -p 3000:3000 schtart
```

Health check: `GET /api/health`. Agent and contributor workflow: `AGENTS.md`.
