# Деплой на прод-сервер

CI/CD собран через GitHub Actions, т.к. эта среда разработки (облачная
сессия Claude Code) не имеет прямого сетевого доступа к серверу по SSH —
только раннеры GitHub Actions могут выйти наружу и подключиться.

Пайплайн: `.github/workflows/deploy.yml` — при пуше в
`claude/crm-server-deployment-bmkzrr` (или вручную через
"Run workflow") раннер:

1. rsync'ит репозиторий (без `.git`, `node_modules`, `dist`, `android`,
   `.env`) на сервер в `/opt/404-crm/`;
2. по SSH запускает `deploy/deploy.sh` на сервере, который:
   - ставит Docker, если его нет (`get.docker.com`);
   - создаёт `.env` из `.env.example`, если его ещё нет, и подставляет туда
     секреты `JWT_SECRET`/`POSTGRES_PASSWORD`, переданные из CI;
   - собирает образ приложения (`docker compose build app`);
   - поднимает `postgres`, прогоняет `prisma migrate deploy`, поднимает `app`;
   - ждёт `GET /health` и в случае ошибки печатает последние логи `app`.

## Секреты репозитория

GitHub → Settings → Secrets and variables → Actions → New repository secret:

| Имя                 | Обязателен | Значение                                           |
|---------------------|------------|-----------------------------------------------------|
| `SSH_PRIVATE_KEY`   | да         | приватный ключ (весь текст, включая строки BEGIN/END) |
| `SSH_HOST`          | да         | `92.242.60.149`                                     |
| `SSH_USER`          | да         | `root`                                              |
| `SSH_PORT`          | нет        | по умолчанию `22`                                   |
| `JWT_SECRET`        | да         | случайная строка (например, `openssl rand -hex 32`) |
| `POSTGRES_PASSWORD` | нет        | по умолчанию `crm` — сменить для прод-окружения     |

Публичная часть ключа `SSH_PRIVATE_KEY` уже должна быть добавлена в
`~/.ssh/authorized_keys` пользователя `SSH_USER` на сервере — сам деплой её
туда не кладёт.

## Первый запуск

1. Добавить секреты выше.
2. Запушить любой коммит, задевающий пути из `on.push.paths` в
   `.github/workflows/deploy.yml` (либо запустить workflow вручную:
   Actions → Deploy CRM to server → Run workflow).
3. Проверить `http://92.242.60.149:3000/health` — должен вернуть
   `{"ok":true}`.

## После первого успешного деплоя

- Сменить `POSTGRES_PASSWORD` на боевое значение (секрет + повторный
  деплой — `docker compose` пересоздаст контейнер `postgres` с новым
  паролем; если volume `postgres_data` уже содержит данные со старым
  паролем, пароль внутри БД придётся сменить вручную через `psql`).
- Отключить вход по паролю на сервере и оставить только
  `SSH_PRIVATE_KEY` (`PasswordAuthentication no` в `sshd_config`).
- Рассмотреть reverse-proxy (Nginx/Caddy) с TLS перед портом 3000 —
  сейчас приложение слушает без TLS напрямую на `:3000`.
