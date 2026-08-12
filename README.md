# Tabula

[![Release](https://img.shields.io/github/v/release/withersky/tabula-plugin?label=release&style=flat-square)](https://github.com/withersky/tabula-plugin/releases/latest)
[![Site](https://img.shields.io/badge/site-withersky.github.io/tabula--plugin-34d399?style=flat-square)](https://withersky.github.io/tabula-plugin/)

**Tabula** — расширение для браузера, которое превращает новую вкладку в **электронную таблицу**.
Закладки раскладываются по ячейкам сетки, как в Excel: со своими листами, темами, фоном, часами и погодой.

- Работает в **Chromium-браузерах** (Chrome, Edge, Brave, Opera, Vivaldi…) и **Firefox 140+**.
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

### Firefox 140+

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
- Шрифт вкладки, размер текста в ячейках, цвет текста.

**Виджеты и удобства**

- Строка **быстрого поиска** с подсказками и выбором поисковика (Google / Яндекс / Bing).
- **Поиск по всем листам** (палитра поиска, `Ctrl+F`): ищет по названию и URL закладок на всех листах и переходит к найденной ячейке.
- **Часы** и **погода** (несколько городов, период обновления; клик открывает попап с прогнозом по дням и по часам — активный город в шапке попапа раскрывает выпадающий список для быстрого переключения, дни в ленте часов раскрашены в шахматном порядке, а сама лента скроллится перетаскиванием мышью, колесом или тачем; формат дат настраивается или отключается). Размер виджетов управляется через общий масштаб.
- Свой заголовок вкладки, фавиконы закладок, импорт/экспорт всех данных в JSON.

**Хоткеи**

Работают и на русской, и на английской раскладках — буквы определяются по физическим клавишам, поэтому сочетания не зависят от текущего языка ввода. Справка по всем клавишам — `F1` или `?`.

| Клавиша                      | Действие                                                            |
|------------------------------|---------------------------------------------------------------------|
| `↑` `↓` `←` `→`              | Перемещение выделения по ячейкам                                    |
| `Home` / `End`               | Начало / конец строки                                               |
| `Ctrl+Home` / `Ctrl+End`     | Первая ячейка (A1) / последняя заполненная ячейка                   |
| `Enter` / `Space`            | Открыть закладку                                                    |
| `Ctrl+Enter` / `Shift+Enter` | Открыть в новой вкладке                                             |
| `F2`                         | Редактировать закладку                                              |
| `Insert`                     | Добавить закладку в выбранную ячейку (или первую свободную)         |
| `Delete` / `Backspace`       | Удалить закладку                                                    |
| `Ctrl+D`                     | Дублировать закладку                                                |
| `Shift+F10`                  | Контекстное меню выбранной ячейки                                   |
| `PageUp` / `PageDown`        | Предыдущий / следующий лист                                         |
| `Ctrl+F`                     | Поиск по всем листам (палитра поиска)                               |
| `Ctrl+K` / `Ctrl+E`          | Фокус в строку быстрого поиска                                      |
| `/`                          | Фокус в строку быстрого поиска                                      |
| `F1` / `?`                   | Справка по горячим клавишам                                         |
| `Esc`                        | Закрыть модалку / меню / палитру поиска / справку                   |

## Настройки

Настройки открываются иконкой ⚙ на новой вкладке. Вверху — единый sticky-блок из шапки и вкладок:

- **Оформление** — тема и линии сетки; колонки и строки новых листов; текст (шрифт вкладки, размер в ячейках, цвет); фон (сплошной цвет, градиент, URL картинки, своё изображение, Bing-обои дня); единая прозрачность панелей, виджетов и ячеек (с блюром) и цвет выделения (свой или **AutoColor** — автоматически подбирается под текущий фон); фавиконы, открытие в новой вкладке, номера строк и буквы колонок, заголовок вкладки.
- **Виджеты** — часы (города), строка быстрого поиска (поисковик, подсказки), погода (города, период обновления, число дней прогноза, формат дат), общий масштаб виджетов.
- **Язык** — Русский / English (переключается «на лету»).
- **Данные** — импорт/экспорт всего датасета в JSON.
- **О программе** — версия, ссылки на сайт и репозиторий.

Справа — **живое превью** новой вкладки. Оно показывается на вкладках «Оформление» и «Виджеты» и обновляется при каждом изменении настройки; ввод в модальных окнах (например, поиск города) превью не обновляет.

---

## Для разработчиков

### Структура файлов

```
tabula-plugin/
├── src/                       исходники расширения (содержимое = пакет)
│   ├── manifest.json          MV3 (Chrome): service_worker, newtab override
│   ├── manifest.firefox.json  MV3 (Firefox 140+): background.scripts, gecko.id
│   ├── background.js          service worker / event page: проксирует Bing и met.no
│   │                          (ответы met.no кешируются в памяти: TTL 10 мин, до 8 городов)
│   ├── lib/
│   │   ├── browser.js         кросс-браузерная обёртка ext.* (chrome.* / browser.*)
│   │   ├── core.js            чистая логика: URL, погода, даты, ключи ячеек
│   │   └── storage.js         дефолты, миграция v1→v2→v3, i18n, helpers
│   ├── i18n/                  переводы (JSON — правят сообществом)
│   │   ├── ru.json, en.json        словарь интерфейса
│   │   ├── symbols.{ru,en}.json    описания погодных символов met.no
│   │   └── generated/              генерируется gen-i18n.mjs; в git не хранится
│   ├── newtab/                страница новой вкладки
│   │   ├── newtab.html
│   │   ├── newtab.css
│   │   └── js/                ES-модули (main, state, grid, sheets, weather, …)
│   ├── options/               страница настроек
│   │   ├── options.html
│   │   ├── options.css
│   │   └── js/                ES-модули (main, form, preview, widgets, data, …)
│   └── icons/
├── scripts/
│   └── gen-i18n.mjs           генератор src/i18n/generated/*.js из JSON
├── build.sh                   сборка dist/{chrome,firefox} из src/
├── site/                      сайт-визитка (GitHub Pages)
│   └── icons/                 копии иконок расширения (на Pages деплоится только site/)
├── tests/                     юнит-тесты чистой логики (см. tests/README.md)
└── .github/workflows/
    ├── release.yml            сборка релизов по коммитам `vX.Y.Z` (с прогоном тестов)
    └── firefox-finalize.yml  ручной долив `update_hash` в updates.json после подписи AMO
```

### Запуск в режиме разработки

Сборка не нужна: отредактируйте файлы и обновите расширение из `chrome://extensions`
(в Firefox — перезагрузите дополнение в `about:debugging`). Все обращения к API
расширения идут через тонкую обёртку [`src/lib/browser.js`](src/lib/browser.js:1), поэтому
Chrome и Firefox используют одну и ту же кодовую базу.

Перед первой загрузкой `src/` как unpacked сгенерируйте браузерные i18n-скрипты —
в репозитории их нет (это производный артефакт):

```bash
node scripts/gen-i18n.mjs   # требуется Node.js; повторяйте после правки src/i18n/*.json
```

### Сборка релизных архивов

```bash
./build.sh chrome    # -> dist/chrome/   (используется src/manifest.json)
./build.sh firefox   # -> dist/firefox/  (используется src/manifest.firefox.json)
./build.sh all       # -> оба варианта
```

Перед копированием `build.sh` генерирует браузерные i18n-скрипты из JSON-словарей
(`node scripts/gen-i18n.mjs`), так что после добавления нового языка достаточно пересобрать.

Полученные папки можно упаковывать в zip и загружать в магазины
(Chrome Web Store, AMO). Папки `site/`, `dist/` и сам `build.sh` в архивы не попадают.

Проверить, что `dist/` не разошёлся с `src/` (после правок легко забыть
пересобрать), можно отдельным скриптом — он пересобирает и сверяет содержимое:

```bash
./scripts/check-sync.sh    # exit 0 — dist синхронен с src; иначе список расхождений
```

### Тесты

Юнит-тесты чистой логики ([`src/lib/core.js`](src/lib/core.js:1), [`src/lib/storage.js`](src/lib/storage.js:1))
на Robot Framework — подробности в [`tests/README.md`](tests/README.md:1).

```bash
./tests/run_tests.sh            # прогнать все тесты
./tests/run_tests.sh --dryrun   # только проверить синтаксис, без исполнения
```

## Релизы

Воркфлоу [`.github/workflows/release.yml`](.github/workflows/release.yml:1) запускается
при каждом push в `main`/`master`. Если **первая строка** commit message начинается
с `vX.Y.Z`, он:

1. Проверяет, что поле `"version"` в [`src/manifest.json`](src/manifest.json:1) и
   [`src/manifest.firefox.json`](src/manifest.firefox.json:1) совпадает с `X.Y.Z` (страховка от рассинхрона).
2. Собирает оба варианта через `./build.sh all` и упаковывает в
   `tabula-chrome-vX.Y.Z.zip` и `tabula-firefox-vX.Y.Z.zip`.
3. Ставит git-тег `vX.Y.Z` и публикует GitHub Release с архивами и полным текстом
   commit message в качестве release notes.

Обычные коммиты (без префикса `vX.Y.Z`) workflow тихо пропускает.

**Процедура релиза:**

1. Поднимите версию в **обоих** манифестах (`src/manifest.json`, `src/manifest.firefox.json`).
2. Коммит, первая строка которого выглядит так:

  ```text
  v1.2.3 - короткое описание релиза

  - подробности изменения 1
  - подробности изменения 2
  ```

3. `git push origin main`. Через ~30 секунд в разделе **Releases** появятся
   релиз с заголовком `Tabula v1.2.3` (git-тег при этом — просто `v1.2.3`) и два
   архива — `tabula-chrome-v1.2.3-unsign.zip` (Chrome) и
   `tabula-firefox-v1.2.3-unsign.xpi` (Firefox, неподписанный). Workflow также
   запишет [`site/latest.json`](site/latest.json:1) и [`site/updates.json`](site/updates.json:1)
   (без `update_hash`) и закоммитит их. Затем release.yml явно запускает
   деплой сайта (см. раздел «Сайт-визитка») через `gh workflow run site.yml`,
   поэтому кнопки скачивания будут указывать на новый релиз.

**Автообновление Firefox (update_url):**

Firefox-манифест [`src/manifest.firefox.json`](src/manifest.firefox.json:1) содержит
`browser_specific_settings.gecko.update_url`, указывающий на
[`site/updates.json`](site/updates.json:1) (GitHub Pages). Это update-манифест,
по которому Firefox находит новые версии для пользователей, установивших
дополнение из релиза:

```json
{
 "addons": {
   "tabula@withersky.local": {
     "updates": [
       { "version": "1.2.3", "update_link": "https://github.com/withersky/tabula-plugin/releases/download/v1.2.3/tabula-firefox-v1.2.3.xpi" }
     ]
   }
 }
}
```

Важное ограничение: Firefox по `update_link` устанавливает **только подписанный**
Mozilla `.xpi` (неподписанный `-unsign` файл он отклонит). Поэтому после того,
как заявка пройдёт ревью в [Центре разработчиков](https://addons.mozilla.org/developers/):

1. Скачайте подписанный `.xpi` из Центра разработчиков.
2. Переименуйте его в `tabula-firefox-v1.2.3.xpi` (без суффикса `-unsign`).
3. Загрузите в **тот же релиз** `v1.2.3` на GitHub (через интерфейс
  **Releases → Attach a file** или командой `gh release upload`).
4. Запустите вручную воркфлоу [`.github/workflows/firefox-finalize.yml`](.github/workflows/firefox-finalize.yml:1)
  (Actions → firefox-finalize, поле `version` = `1.2.3`). Он возьмёт подписанный
  `.xpi` из релиза, посчитает `sha256` и допишет `update_hash` в `updates.json`,
  затем закоммитит и явно запустит деплой сайта (`gh workflow run site.yml`,
  см. раздел «Сайт-визитка»). Пока подписанный файл не
  загружен и `update_hash` не добавлен, Firefox проверит подпись по https при скачивании.

## Сайт-визитка и GitHub Pages

Папка [`site/`](site/index.html:1) — статичный одностраничный сайт с кнопками
скачивания. Стиль сайта повторяет интерфейс расширения (та же палитра, что в
[`src/options/options.css`](src/options/options.css:1), и CSS-мокап новой вкладки), а в шапке и фавиконке
используется настоящая иконка Tabula, в кнопках скачивания — логотипы браузеров
(`chromium.svg`, `firefox.svg`). Копии всех этих ресурсов лежат в `site/icons/`
(на GitHub Pages публикуется только папка `site/`, поэтому иконки продублированы
рядом). Если вы поменяете `src/icons/icon*.png` или `src/icons/*.svg` — обновите
и копии в `site/icons/`.

Скрипт [`site/main.js`](site/main.js:1) подставляет кнопкам прямые ссылки на
файлы релиза. Сначала он читает статический снимок [`site/latest.json`](site/latest.json:1)
(тот же origin — работает даже при недоступности `api.github.com`), затем для
точности фоново уточняет данные через GitHub API. Снимок обновляет release workflow
при каждом релизе, поэтому кнопки всегда ведут на актуальные
`tabula-chrome-vX.Y.Z-unsign.zip` и `tabula-firefox-vX.Y.Z-unsign.xpi`.

В той же папке лежит [`site/updates.json`](site/updates.json:1) — Firefox
update-манифест для `update_url` из [`src/manifest.firefox.json`](src/manifest.firefox.json:1).
Release workflow пишет его при каждом релизе (без `update_hash`), а
[`firefox-finalize.yml`](.github/workflows/firefox-finalize.yml:1) дописывает
`sha256` (`update_hash`) после загрузки подписанного `.xpi`. Файл всегда актуален
и доступен по `https://withersky.github.io/tabula-plugin/updates.json`.

Деплой сайта выполняется отдельным воркфлоу
[`.github/workflows/site.yml`](.github/workflows/site.yml:1), который публикует
**только содержимое папки `site/`** на GitHub Pages. Остальные папки репозитория
(`src/`, `Tests/`, `.github/` и т.д.) на сайт не попадают и остаются приватными.

**Важно:** в **Settings → Pages → Build and deployment** источник должен быть
**«GitHub Actions»** (а не ветка). Это требование самого `site.yml` — иначе
деплой не сработает.

Воркфлоу запускается двумя способами:
- **Вручную** — Actions → site → Run workflow (например, при правке статики сайта).
- **Автоматически** — из [`release.yml`](.github/workflows/release.yml:1) и
  [`firefox-finalize.yml`](.github/workflows/firefox-finalize.yml:1) через
  `gh workflow run site.yml`. Прямой вызов нужен, потому что пуш от `GITHUB_TOKEN`
  не запускает соседние воркфлоу (защита GitHub от рекурсии), иначе сайт бы
  не обновился после правок `site/` этими воркфлоу.

**Как опубликовать правки сайта вручную:**

1. Измените файлы в `site/`.
2. Обычный коммит и push в `main`.
3. Запустите воркфлоу `site` вручную (Actions → site → Run workflow).
4. Через ~1 минуту сайт обновится на `https://withersky.github.io/tabula-plugin/`.

## Модель данных

Данные лежат в `chrome.storage.local` под ключом `tabula_data`, текущий формат — **v3**:

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
    "fontFamilyKey": "system",
    "backgroundType": "gradient",          // color | gradient | imageUrl | imageUpload | bing
    "showFavicon": true,
    "openInNewTab": false,
    "showClock": true,
    "showWeather": true,
    "language": "ru"
  },
  "bingCache":     { "date": "2026-07-30", "url": "...", "copyright": "..." },
  "weatherCaches": { "<cityId>": { "ok": true, "symbol": "clearsky_day", "tempC": 12.4, ... } }
}
```

`Storage.get()` автоматически поднимает старые форматы:
**v1** (`tabs` + `groups`) → каждая группа становится листом;
**v2** (`sheets[].tabs`) → каждый tab превращается в `cells["row,0"]`;
**v3** (текущий) — без миграции. После миграции данные сохраняются обратно.

## Кастомизация

Частые правки:

- Стартовые закладки и листы — `defaultData()` в [`src/lib/storage.js`](src/lib/storage.js:1).
- Дефолтная тема — объект `settings` там же.
- CSS-переменные (`--columns`, `--font-family`, …) — в `:root` в [`src/newtab/newtab.css`](src/newtab/newtab.css:1).
  Строки грида делят доступную высоту поровну; их количество задаётся `settings.gridRows`.
- Переводы — добавьте `src/i18n/<lang>.json` (и при необходимости `src/i18n/symbols.<lang>.json`),
  затем запустите `node scripts/gen-i18n.mjs` и добавьте radio-карточку `name="language"` в
  [`src/options/options.html`](src/options/options.html:432). JSON не требует правки JS-кода,
  поэтому переводы легко делать сообществу. Строки с плейсхолдерами используют `{name}`/`{n}`.
- Ссылки на скачивание на сайте — меняются автоматически из последнего релиза, ничего править не нужно.

## Заметки

- **Фавиконы** подгружаются через Google Favicon Service; если иконки нет — буквенный бейдж.
- **Свои изображения** хранятся как data URL в `chrome.storage.local` (лимит ~2 МБ).
- **Bing daily** подгружается через service worker (нужны `host_permissions`), кешируется на день.
- **Погода met.no** запрашивается через service worker; успешные ответы кешируются в памяти
  на 10 минут (до 8 городов), чтобы не дёргать API при частом открытии попапа.
- **Синхронизация между устройствами** не предусмотрена — используйте экспорт/импорт JSON.
- **Автообновление Firefox** работает только через `update_url` на подписанный `.xpi` (см. раздел «Релизы»); неподписанные сборки пользователям не обновляются автоматически.
- Требования: Manifest V3, Chrome 108+; Firefox 140+ (в Firefox-сборке используется `background.scripts`).
