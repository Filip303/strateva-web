#!/bin/sh
# Entrypoint: enforce an explicit, mandatory deployment mode BEFORE Caddy
# binds. `STRATEVA_DEPLOYMENT_ENV` must be exactly `staging` or `production`;
# anything else (missing, empty or a typo) aborts with a non-zero exit, so a
# misconfigured production can never silently start without HSTS. Caddy then
# reads the SAME validated variable to decide whether to send HSTS — one
# variable, no second manual toggle that could diverge. The value itself is
# the only thing inspected and is never echoed beyond the two safe literals.
set -eu

case "${STRATEVA_DEPLOYMENT_ENV:-}" in
	staging | production) ;;
	*)
		echo "STRATEVA_DEPLOYMENT_ENV must be 'staging' or 'production'." >&2
		exit 1
		;;
esac

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
