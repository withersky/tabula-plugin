# Tabula

[![Release](https://img.shields.io/github/v/release/withersky/tabula-plugin?label=release&style=flat-square)](https://github.com/withersky/tabula-plugin/releases/latest)
[![Site](https://img.shields.io/badge/site-withersky.github.io/tabula--plugin-34d399?style=flat-square)](https://withersky.github.io/tabula-plugin/)

**Tabula** — расширение для браузера, которое превращает новую вкладку в **электронную таблицу**.
Закладки раскладываются по ячейкам сетки, как в Excel: со своими листами, темами, фоном, часами и погодой.

- Работает в **Chromium-браузерах** (Chrome, Edge, Brave, Opera, Vivaldi…) и **Firefox 109+**.
- Интерфейс — на русском, в настройках переключается на английский.
- **Без подписок, без телеметрии** — все данные хранятся локально в вашем браузере.
- Автор: [withersky](https://github.com/withersky).

> 🌐 Сайт-визитка с кнопками скачивания: <https://withersky.github.io/tabula-plugin/>

## Установка

### Chrome / Edge / Brave / Opera / Vivaldi

1. Скачайте архив **Chrome** со [страницы релизов](https://github.com/withersky/tabula-plugin/releases/latest).
2. Распакуйте его в любую папку.
3. Откройте `chrome://extensions` (или `edge://extensions`) и включите **«Режим разработчика»**.
4. Нажмите **«Загрузить распакованное расширение»** и выберите распакованную папку.
5. Откройте новую вкладку — появится таблица. Настройки — иконка ⚙ в правом верхнем углу.

### Firefox 109+

1. Скачайте архив **Firefox** со [страницы релизов](https://github.com/withersky/tabula-plugin/releases/latest).
2. Распакуйте его в любую папку.
3. Откройте `about:debugging#/runtime/this-firefox`.
4. Нажмите **«Загрузить временное дополнение…»** и выберите файл `manifest.json` из папки.

> Если другое расширение уже переопределяет новую вкладку, отключите его —
> браузер использует только одно такое расширение одновременно.

## Возможности

**Листы и сетка**

- Несколько **листов** внизу, как вкладки Excel: emoji-иконки, переименование двойным кликом, перетаскивание для смены порядка, своё число колонок (3–12) и контекстное меню.
- **Сетка ячеек**: каждая ячейка — одна закладка. Пустые ячейки просто пустые, «привязки к строке» нет.
- Перетаскивание: на пустую ячейку — переместить, на заполненную — поменять местами.
- Клик — открыть закладку, Ctrl/Cmd+клик — в новой вкладке, средняя кнопка мыши — тоже новая вкладка.
- Правый клик — контекстное меню: открыть / в новой вкладке / изменить / дублировать / удалить.

**Оформление**

- Тёмная и светлая тема, линии сетки (вкл/выкл), номера строк и буквы колонок.
- Фон: сплошной цвет, CSS-градиент, URL картинки, своё изображение или **Bing: изображение дня** (обновляется автоматически).
- Шрифт, размер текста, цвет текста, масштаб ячеек (20–200%).

**Виджеты и удобства**

- Строка **быстрого поиска** с подсказками и выбором поисковика (Google / Яндекс / Bing).
- **Часы** (шрифт и размер настраиваются) и **погода** (город или координаты, размер, период обновления; клик открывает Яндекс.Погоду).
- Свой заголовок вкладки, фавиконы закладок, импорт/экспорт всех данных в JSON.

**Хоткеи**

| Клавиша      | Действие                                                  |
|--------------|-----------------------------------------------------------|
| `/`          | Фокус на строку быстрого поиска                            |
| `N`          | Добавить закладку в первую пустую ячейку активного листа   |
| `Esc`        | Закрыть модалку / снять выделение                          |

## Настройки

Настройки открываются иконкой ⚙ на новой вкладке и состоят из карточек:

- **Оформление** — тема, линии сетки.
- **Сетка** — колонки новых листов, размер ячеек.
- **Текст** — шрифт, размер, цвет.
- **Фон** — пять режимов, включая Bing-обои дня.
- **Поведение** — фавиконы, новая вкладка, номера строк, буквы колонок, листы, поиск, линии, часы, погода.
- **Язык** — Русский / English (переключается «на лету»).
- **Импорт/экспорт** — весь датасет в JSON.

---

## Для разработчиков

### Структура файлов

```
tabula-plugin/
├── manifest.json           MV3 (Chrome): service_worker, newtab override
├── manifest.firefox.json   MV3 (Firefox 109+): background.scripts, gecko.id
├── background.js           service worker / event page: проксирует Bing и met.no
├── lib/
│   ├── browser.js          кросс-браузерная обёртка ext.* (chrome.* / browser.*)
│   └── storage.js          дефолты, миграция v1→v2→v3, i18n, helpers
├── newtab.html/css/js      новая вкладка: сетка, листы, модалки, drag-drop
├── options.html/css/js     страница настроек
├── build.sh                сборка dist/{chrome,firefox}
├── site/                   сайт-визитка (GitHub Pages)
│   └── icons/              копии иконок расширения (на Pages деплоится только site/)
├── icons/
└── .github/workflows/
    ├── release.yml         сборка релизов по коммитам `vX.Y.Z`
    └── site.yml            деплой сайта по коммитам `site:`
```

### Запуск в режиме разработки

Сборка не нужна: отредактируйте файлы и обновите расширение из `chrome://extensions`
(в Firefox — перезагрузите дополнение в `about:debugging`). Все обращения к API
расширения идут через тонкую обёртку [`lib/browser.js`](lib/browser.js:1), поэтому
Chrome и Firefox используют одну и ту же кодовую базу.

### Сборка релизных архивов

```bash
./build.sh chrome    # -> dist/chrome/   (используется manifest.json)
./build.sh firefox   # -> dist/firefox/  (используется manifest.firefox.json)
./build.sh all       # -> оба варианта
```

Полученные папки можно упаковывать в zip и загружать в магазины
(Chrome Web Store, AMO). Папки `site/`, `dist/` и сам `build.sh` в архивы не попадают.

## Релизы

Воркфлоу [`.github/workflows/release.yml`](.github/workflows/release.yml:1) запускается
при каждом push в `main`/`master`. Если **первая строка** commit message начинается
с `vX.Y.Z`, он:

1. Проверяет, что поле `"version"` в [`manifest.json`](manifest.json:1) и
   [`manifest.firefox.json`](manifest.firefox.json:1) совпадает с `X.Y.Z` (страховка от рассинхрона).
2. Собирает оба варианта через `./build.sh all` и упаковывает в
   `tabula-chrome-vX.Y.Z.zip` и `tabula-firefox-vX.Y.Z.zip`.
3. Ставит git-тег `vX.Y.Z` и публикует GitHub Release с архивами и полным текстом
   commit message в качестве release notes.

Обычные коммиты (без префикса `vX.Y.Z`) workflow тихо пропускает.

**Процедура релиза:**

1. Поднимите версию в **обоих** манифестах (`manifest.json`, `manifest.firefox.json`).
2. Коммит, первая строка которого выглядит так:

   ```text
   v1.2.3 - короткое описание релиза

   - подробности изменения 1
   - подробности изменения 2
   ```

3. `git push origin main`. Через ~30 секунд в разделе **Releases** появятся
   `v1.2.3` и два zip-архива (их можно скачать с сайта-визитки).

## Сайт-визитка и GitHub Pages

Папка [`site/`](site/index.html:1) — статичный одностраничный сайт с кнопками
скачивания. Стиль сайта повторяет интерфейс расширения (та же палитра, что в
[`options.css`](options.css:1), и CSS-мокап новой вкладки), а в шапке и фавиконке
используется настоящая иконка Tabula, в кнопках скачивания — логотипы браузеров
(`chromium.svg`, `firefox.svg`). Копии всех этих ресурсов лежат в `site/icons/`
(на GitHub Pages публикуется только папка `site/`, поэтому иконки продублированы
рядом). Если вы поменяете `icons/icon*.png` или `icons/*.svg` в корне — обновите
и копии в `site/icons/`.

Скрипт [`site/main.js`](site/main.js:1) сам запрашивает последний релиз через
GitHub API и подставляет прямые ссылки на zip-архивы (Chrome/Firefox).

Деплой — воркфлоу [`.github/workflows/site.yml`](.github/workflows/site.yml:1).
Он срабатывает, когда **первая строка** commit message начинается с `site:`
(например `site: обновил кнопки скачивания`), и публикует содержимое `site/`
на GitHub Pages. Обычные коммиты сайт не трогают.

**Как опубликовать сайт:**

1. Измените файлы в `site/`.
2. Коммит с первой строкой `site: ...` и push в `main`.
3. Через ~1 минуту сайт обновится на `https://withersky.github.io/tabula-plugin/`.

**Требование:** в **Settings → Pages → Build and deployment** источник должен быть
**«GitHub Actions»** (а не ветка). Права workflow выдаёт себе сам через `permissions`,
секреты не нужны.

## Модель данных

Данные лежат в `chrome.storage.local` под ключом `gridtabs_data`, текущий формат — **v3**:

```jsonc
{
  "sheets": [
    {
      "id": "uuid",
      "name": "Главная",
      "icon": "📋",                        // emoji для вкладки листа
      "columns": 8,                        // 3..12, своё на каждый лист
      "cells": {
        "0,0": { "id": "uuid", "title": "Google",  "url": "https://google.com" },
        "2,4": { "id": "uuid", "title": "GitHub",  "url": "https://github.com" }
        // пустые ячейки просто отсутствуют в объекте
      }
    }
  ],
  "activeSheetId": "uuid",
  "settings": {
    "defaultColumns": 8,
    "cellHeight": 100,
    "fontFamilyKey": "system",
    "backgroundType": "gradient",          // color | gradient | imageUrl | imageUpload | bing
    "showFavicon": true,
    "openInNewTab": false,
    "showClock": true,
    "showWeather": true,
    "language": "ru"
  },
  "bingCache":    { "date": "2026-07-30", "url": "...", "copyright": "..." },
  "weatherCache": { "ok": true, "symbol": "clearsky_day", "tempC": 12.4, ... }
}
```

`Storage.get()` автоматически поднимает старые форматы:
**v1** (`tabs` + `groups`) → каждая группа становится листом;
**v2** (`sheets[].tabs`) → каждый tab превращается в `cells["row,0"]`;
**v3** (текущий) — без миграции. После миграции данные сохраняются обратно.

## Кастомизация

Частые правки:

- Стартовые закладки и листы — `defaultData()` в [`lib/storage.js`](lib/storage.js:1).
- Дефолтная тема — объект `settings` там же.
- CSS-переменные (`--columns`, `--cell-height`, `--font-family`, …) — в `:root` в [`newtab.css`](newtab.css:1).
  Реальный размер ячейки в пикселях пересчитывается в [`applyCellScale()`](newtab.js) из `settings.cellHeight` (%).
- Переводы — добавьте язык в `I18N` в [`lib/storage.js`](lib/storage.js:1) и `<option>` в [`options.html`](options.html:1) (`#languageSelect`).
- Ссылки на скачивание на сайте — меняются автоматически из последнего релиза, ничего править не нужно.

## Заметки

- **Фавиконы** подгружаются через Google Favicon Service; если иконки нет — буквенный бейдж.
- **Свои изображения** хранятся как data URL в `chrome.storage.local` (лимит ~2 МБ).
- **Bing daily** подгружается через service worker (нужны `host_permissions`), кешируется на день.
- **Синхронизация между устройствами** не предусмотрена — используйте экспорт/импорт JSON.
- Требования: Manifest V3, Chrome 108+; Firefox 109+ (MV3 service worker — только с 121, поэтому в Firefox-сборке используется `background.scripts`).
