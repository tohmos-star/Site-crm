#!/usr/bin/env bash
# Выполняется на целевом сервере (вызывается из .github/workflows/deploy.yml
# по SSH после rsync репозитория). Идемпотентен — безопасно гонять повторно.
set -euo pipefail
cd "$(dirname "$0")/.."

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Docker не найден, устанавливаю..."
  curl -fsSL https://get.docker.com | $SUDO sh
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin недоступен даже после установки Docker" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "==> .env отсутствует, создаю из .env.example"
  cp .env.example .env
fi

# CI передаёт секреты через переменные окружения — переносим их в .env,
# чтобы docker compose подставил их в docker-compose.yml.
set_env_var() {
  local key="$1" value="$2"
  if [ -n "$value" ]; then
    if grep -q "^${key}=" .env; then
      sed -i "s|^${key}=.*|${key}=${value}|" .env
    else
      echo "${key}=${value}" >> .env
    fi
  fi
}
set_env_var JWT_SECRET "${JWT_SECRET:-}"
set_env_var POSTGRES_PASSWORD "${POSTGRES_PASSWORD:-}"

echo "==> Собираю образ приложения"
$SUDO docker compose build app

echo "==> Поднимаю postgres"
$SUDO docker compose up -d postgres

echo "==> Прогоняю миграции Prisma"
$SUDO docker compose run --rm app npx prisma migrate deploy

echo "==> Прогоняю seed (идемпотентно — создаёт клуб/зоны/тарифы и дефолтного админа при первом запуске)"
# --build обязателен: без него compose переиспользует уже собранный образ
# seed с прошлого деплоя (даже если Dockerfile/schema.prisma поменялись),
# и его Prisma Client рассинхронизируется с реальной БД после миграции —
# см. коммит с массивом кодов двери, который на этом словил P2022.
$SUDO docker compose --profile tools run --build --rm seed

echo "==> Поднимаю app"
$SUDO docker compose up -d app

echo "==> Проверка здоровья"
for i in $(seq 1 10); do
  if curl -fsS http://localhost:3000/health >/dev/null; then
    echo "OK: приложение отвечает на /health"
    exit 0
  fi
  sleep 2
done

echo "Приложение не ответило на /health за отведённое время" >&2
$SUDO docker compose logs --tail=100 app
exit 1
