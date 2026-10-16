#!/usr/bin/env bash
# Vercel "Ignored Build Step", wired up as `ignoreCommand` in vercel.json.
# Exit 0 skips the deployment, exit 1 builds it.
#
# Skips only when every change since the last successful deployment of this
# branch is inside workers/pmtiles, which Cloudflare Workers Builds deploys.
# Anything uncertain builds.

base="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ -z "$base" ]; then
    echo "No previous deployment on this branch; building."
    exit 1
fi

if ! git cat-file -e "${base}^{commit}" 2> /dev/null; then
    echo "Previous deployment ${base} is not in the clone; building."
    exit 1
fi

if git diff --quiet "$base" HEAD -- ':(top)' ':(top,exclude)workers/pmtiles'; then
    echo "Only workers/pmtiles changed since ${base}; skipping."
    exit 0
fi

echo "App files changed since ${base}; building."
exit 1
