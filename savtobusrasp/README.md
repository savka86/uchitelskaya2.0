# SAVTOBUSRASP

Расписание маршрута № 2 по селу Намцы. Исходники размещаются в GitHub, приложение публикуется на Vercel, данные маршрутов и остановок хранятся в Supabase.

## Запуск

1. Скопируйте `.env.example` в `.env.local`.
2. Укажите `SUPABASE_URL` и `SUPABASE_PUBLISHABLE_KEY`.
3. Выполните `npm install` и `npm run dev`.

Секретный `service_role` ключ приложению не требуется и не должен попадать в браузер или репозиторий.
