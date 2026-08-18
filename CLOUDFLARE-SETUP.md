# Настройка автодеплоя сайта в Cloudflare Workers (Git-интеграция)

Сайт папки `site/` публикуется на Worker `tabula` автоматически при
пуше в ветку `main` (через Cloudflare Workers Builds). Ниже — точные пути
в дашборде Cloudflare. Это делается один раз вручную; в репозитории уже
лежат `wrangler.toml` и `worker.js`, которые CF подхватит при деплое.

## Путь в интерфейсе (слева направо)

```
dash.cloudflare.com
  → Workers & Pages            (верхнее меню)
    → tabula-plugin            (воркер из списка)
      → Settings               (вкладка)
        → Builds               (раздел слева)
          → Connect / Connect Git repository
```

## Шаги мастера подключения

1. **Connect a Git repository**
   → выбрать провайдер **GitHub**
   → репозиторий **withersky/tabula-plugin**

2. **Production branch** → `main`

3. **Build command** → **оставить пустым**
   (сайт статичный, пересборка не нужна; `wrangler.toml` уже указывает
   `assets.directory = "site"`)

4. **Deploy command** → `wrangler deploy`
   (конфиг берётся из `wrangler.toml` в корне репозитория)

5. **Path filter** (рекомендуется)
   → включить переключатель «Build only on changes to specific paths»
     (также встречается как «Builds → Path filters» или
      «Only build when files in these paths change» — название зависит
      от версии UI)
   → выбрать режим **Include** (НЕ Exclude)
   → добавить путь: `site/**`
   Пояснение: Include = «деплой только если изменился этот путь».
   Exclude наоборот запретил бы деплой сайта, поэтому НЕ используйте его.
   - Если поля нет в мастере подключения — оно появляется после подключения
     на вкладке **Settings → Builds → Path filters**.
   - С фильтром сборка запускается ТОЛЬКО при изменениях в папке сайта:
       * обычные (нерелизные) коммиты в другие папки НЕ тратят время на деплой;
       * релизные воркфлоу (release.yml / firefox-finalize.yml), которые пушат
         `site/latest.json` и `site/updates.json`, попадают под фильтр и
         автоматически вызывают перезаливку.

6. **Save / Connect**
   → после сохранения пуш, меняющий `site/**`, автоматически перезаливает сайт.

## Проверка

После первого пуша в `main` (или сразу после Connect, если выбрана опция
начальной сборки) зайдите на `https://tabula.withersky.workers.dev` — должен
открыться сайт из папки `site/`. Изменения `site/latest.json` и
`site/updates.json` от релизных воркфлоу подхватятся автоматически, и
Firefox увидит новую версию по `https://tabula.withersky.workers.dev/updates.json`.
