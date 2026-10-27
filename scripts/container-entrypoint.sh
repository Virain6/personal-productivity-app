#!/bin/sh
set -eu
umask 077
node scripts/deploy-db.mjs migrate
exec "$@"
