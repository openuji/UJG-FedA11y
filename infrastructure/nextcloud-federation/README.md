# Nextcloud Federation Test Stack

Lean local infrastructure for testing a federated Nextcloud file-share journey with Playwright.

## Topology

- Alice: `http://host.docker.internal:18081`
- Bob: `http://host.docker.internal:18082`
- Federated recipient: `bob@http://host.docker.internal:18082`

The instances use the same host name with separate published ports. Playwright on the host and Nextcloud inside Docker both resolve `host.docker.internal`, so federated backend requests do not use `localhost`.

## Start

```sh
docker compose --env-file infrastructure/nextcloud-federation/.env -f infrastructure/nextcloud-federation/compose.yaml up -d
infrastructure/nextcloud-federation/scripts/provision.sh
infrastructure/nextcloud-federation/scripts/seed.sh
```

## Credentials

Credentials and URLs are defined once in `.env`, which can be loaded by Docker Compose, shell scripts, and Playwright.

- Alice user: `NEXTCLOUD_ALICE_USER` / `NEXTCLOUD_ALICE_PASSWORD`
- Bob user: `NEXTCLOUD_BOB_USER` / `NEXTCLOUD_BOB_PASSWORD`
- Instance admin user on both instances: `NEXTCLOUD_ADMIN_USER` / `NEXTCLOUD_ADMIN_PASSWORD`

## Playwright environment

```sh
set -a
. infrastructure/nextcloud-federation/.env
set +a
```

Expected smoke scenario:

1. Alice logs in to Instance A.
2. Alice opens Files.
3. Alice opens the sharing interface for `report.pdf`.
4. Alice shares with `$NEXTCLOUD_FEDERATED_RECIPIENT`.
5. Bob logs in to Instance B.
6. Bob accepts the pending federated share.
7. `report.pdf` is available in Bob's files.

## Checks

```sh
docker compose --env-file infrastructure/nextcloud-federation/.env -f infrastructure/nextcloud-federation/compose.yaml config
curl -fsS http://host.docker.internal:18081/status.php
curl -fsS http://host.docker.internal:18082/status.php
docker compose --env-file infrastructure/nextcloud-federation/.env -f infrastructure/nextcloud-federation/compose.yaml exec -T alice php -r 'echo gethostbyname("host.docker.internal"), PHP_EOL;'
```

## Reset

```sh
infrastructure/nextcloud-federation/scripts/reset.sh
```
