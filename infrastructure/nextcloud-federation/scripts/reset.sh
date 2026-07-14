#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
STACK_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ENV_FILE="$STACK_DIR/.env"

docker compose --env-file "$ENV_FILE" -f "$STACK_DIR/compose.yaml" down -v --remove-orphans
