# Multi-stage, reproducible image serving the static Vite build with Caddy.
#
# Build stage: the exact Node version pinned by the repo (.nvmrc / engines),
# a clean install from the lockfile, fail-fast validation of the public
# VITE_API_URL build argument, production build and bundle verification.
# Runtime stage: ONLY Caddy, its rendered config and dist/ — no Node, no
# sources, no node_modules, no Git, no tests. Both bases are pinned to an
# explicit version AND digest (never `latest`).

FROM node:22.22.2-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# .dockerignore keeps Git, env files, tests and build output out of the
# context; only what the build needs is copied.
COPY . .

# VITE_API_URL is the PUBLIC API origin baked into the browser bundle
# (public by definition — never a secret). The build FAILS here if it is
# missing or not a clean http(s) origin; the validated, normalized origin is
# then the single value used for BOTH the app bundle and the CSP
# connect-src, so the two can never diverge.
ARG VITE_API_URL
RUN node scripts/validate-api-origin.mjs "$VITE_API_URL" > /tmp/api-origin

RUN VITE_API_URL="$(cat /tmp/api-origin)" npm run build && npm run verify:dist

# Render the Caddyfile template with the validated origin. The origin is a
# normalized URL origin, so it can never contain the sed delimiter or
# replacement metacharacters. Fail if the placeholder did not render.
RUN sed "s|__API_ORIGIN__|$(cat /tmp/api-origin)|" Caddyfile > /tmp/Caddyfile \
	&& ! grep -q '__API_ORIGIN__' /tmp/Caddyfile \
	&& grep -qF "connect-src 'self' $(cat /tmp/api-origin);" /tmp/Caddyfile

FROM caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d

COPY --from=build /tmp/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv/dist
# The entrypoint enforces the mandatory deployment mode before Caddy binds.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Run as a non-privileged user. Railway's injected PORT is dynamic, so the
# Caddy binary gets CAP_NET_BIND_SERVICE (file capability) to stay
# compatible even if a port below 1024 is ever assigned; libcap is removed
# again after use. /config and /data are Caddy's XDG homes in this image.
RUN apk add --no-cache libcap \
	&& setcap cap_net_bind_service=+ep /usr/bin/caddy \
	&& apk del libcap \
	&& chmod 0755 /usr/local/bin/docker-entrypoint.sh \
	&& addgroup -S web \
	&& adduser -S -G web -H web \
	&& chown -R web:web /config /data

# Catch config errors at build time, not at boot (placeholder values only).
RUN PORT=8080 STRATEVA_DEPLOYMENT_ENV=staging caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

USER web

# The entrypoint validates STRATEVA_DEPLOYMENT_ENV (staging|production) and
# then exec's Caddy; a missing or invalid mode exits non-zero before boot.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
