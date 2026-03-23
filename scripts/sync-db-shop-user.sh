#!/usr/bin/env bash
# Reset the Docker MySQL user `shop` password to match docker-compose / DATABASE_URL.
# Run from repo root: bash scripts/sync-db-shop-user.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT_PASS="${MYSQL_ROOT_PASSWORD:-root}"
SHOP_PASS="${SHOP_PASSWORD:-shop}"

docker compose exec -T db mysql -uroot -p"${ROOT_PASS}" <<SQL
CREATE USER IF NOT EXISTS 'shop'@'%' IDENTIFIED WITH mysql_native_password BY '${SHOP_PASS}';
ALTER USER 'shop'@'%' IDENTIFIED WITH mysql_native_password BY '${SHOP_PASS}';
GRANT ALL PRIVILEGES ON shop.* TO 'shop'@'%';
FLUSH PRIVILEGES;
SQL

echo "OK: shop user password set to '${SHOP_PASS}'. Use DATABASE_URL=mysql://shop:${SHOP_PASS}@localhost:3306/shop"
