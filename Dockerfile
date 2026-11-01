# syntax=docker/dockerfile:1
# Node 26 has no bundled corepack, so pnpm is installed at the version pinned in package.json.
FROM node:26-alpine AS base
RUN npm install -g pnpm@12.16.1
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY package.json .
USER node
EXPOSE 3000
CMD ["node", "build"]
