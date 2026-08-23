# Радар АЗС — схема публикации

## Что уже подготовлено

- PWA manifest: `manifest.webmanifest`
- Service Worker: `service-worker.js`
- PWA icon: `pwa-icon.svg`
- PWA shell: `pwa.html`
- Vercel config: `vercel.json`
- Android update metadata: `version.json`

## Vercel

При импорте репозитория в Vercel выбрать Root Directory: `fuel-radar`.
Framework Preset: Other / Static.
Build Command: пусто.
Output Directory: пусто.

После успешной проверки production URL можно отключать GitHub Pages и только затем менять основной репозиторий на Private.

## Android releases

APK не хранить в исходном приватном репозитории как часть сайта. Для публичных установок использовать отдельный release-канал (GitHub Releases или другой CDN). После публикации APK записывать постоянную ссылку и SHA-256 в `version.json`.

## Подпись APK

Не хранить `.jks`, пароль или base64 keystore в репозитории.
Для стабильных обновлений создать постоянный release keystore и сохранить его только в GitHub Actions Secrets, например:

- `RADAR_KEYSTORE_B64`
- `RADAR_KEYSTORE_PASSWORD`
- `RADAR_KEY_ALIAS`
- `RADAR_KEY_PASSWORD`

Все будущие версии APK должны использовать один и тот же ключ, один package id `ru.radarazs.yakutsk` и возрастающий `versionCode`.
