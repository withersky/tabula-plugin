# Тесты Tabula

Юнит-тесты **чистой логики** расширения ([`src/lib/core.js`](../src/lib/core.js:1) и [`src/lib/storage.js`](../src/lib/storage.js:1))
на [Robot Framework](https://robotframework.org/). Браузер и расширение не запускаются:
функции вызываются в отдельном Node-процессе, результат сравнивается с ожидаемым значением.

## Структура

```
tests/
├── requirements.txt          зависимости (robotframework)
├── run_tests.sh              скрипт запуска → tests/results/
├── lib/
│   ├── TabulaCoreLibrary.py  ключевые слова Robot: вызов core/storage-функций
│   └── core_runner.js        мост: читает JSON-запрос из stdin, исполняет в Node,
│                             пишет JSON-ответ в stdout
└── suites/
    ├── test_background.robot  src/lib/core.js: символы met.no → коды WWO, num(), свёртка прогноза по дням
    ├── test_newtab.robot      src/lib/core.js: URL, фавиконки, бейджи, ключи сетки, погода, даты, агрегатор
    └── test_storage.robot     src/lib/storage.js: буквы столбцов, листы, i18n, миграции, дефолты
```

## Требования и установка

- **Node.js** — исполняет логику `src/lib/core.js` и `src/lib/storage.js`.
- **Robot Framework** — см. [`requirements.txt`](requirements.txt:1):

```bash
python3 -m pip install --user --break-system-packages robotframework
```

## Запуск

```bash
./tests/run_tests.sh          # все тесты
./tests/run_tests.sh --dryrun # только проверить синтаксис, без исполнения
```

Результаты — в `tests/results/`: `log.html`, `report.html`, `output.xml`.

## Как это работает

1. Тест вызывает ключевое слово библиотеки, например
   `Core Function Should Equal  symbolToCode  113  clearsky_day`.
2. [`TabulaCoreLibrary.py`](lib/TabulaCoreLibrary.py:1) собирает JSON-запрос
   `{ "ns": "core", "fn": "symbolToCode", "args": ["clearsky_day"] }` и передаёт его в
   [`core_runner.js`](lib/core_runner.js:1) через stdin.
3. Runner выполняет функцию в Node и возвращает `{ "ok": true, "value": 113 }`.
4. Библиотека сравнивает результат с ожидаемым значением.

Каждый вызов — **отдельный процесс Node**, поэтому состояние между вызовами не разделяется
и тесты детерминированы.

### Ключевые слова

| Ключевое слово | Назначение |
|---|---|
| `Core Function Should Equal` | вызвать функцию из `src/lib/core.js` и сравнить с ожидаемым |
| `Storage Function Should Equal` | то же для `src/lib/storage.js` |
| `Call Core Function` / `Call Storage Function` | вызвать и вернуть результат для дальнейших проверок |
| `Core Function Should Error` / `Storage Function Should Error` | вызвать и ожидать исключение, вернуть текст ошибки |

Имя функции может быть и **константой** экспорта (`I18N`, `DEFAULT_DATA`, `FONT_FAMILIES`, `WEATHER_ICON_EMOJI`…).

### Типы аргументов

Строки-аргументы, выглядящие как JSON-литералы, разбираются автоматически:
`25` → число, `true`/`false` → булевы, `null` → `None`, `[...]` → список, `{...}` → словарь.
Обычные строки передаются как есть.

Для нестандартных значений используются **маркеры** в виде JSON-объектов:

| Маркер | Значение | Пример использования |
|---|---|---|
| `{"$date": "ISO"}` | `new Date(ISO)` | `dayLabel`, `formatDateFmt` |
| `{"$resolve": v}` | `Promise.resolve(v)` | `withTimeout` — успех |
| `{"$reject": "msg"}` | `Promise.reject(Error(msg))` | `withTimeout` — ошибка |
| `{"$never": true}` | Promise, который не резолвится | `withTimeout` — таймаут |
| `{"$undefined": true}` | `undefined` | «нет координат» для `aggregatorUrl` |

## Как добавить тест

1. Выберите сьют по модулю: `core` → `test_newtab.robot` / `test_background.robot`, `storage` → `test_storage.robot`.
2. Добавьте тест-кейс в конце файла:

```robot
My Feature Works
    [Documentation]    Краткое пояснение, что проверяем
    Core Function Should Equal    myFunction    expectedResult    arg1    arg2
```

3. Убедитесь, что функция экспортируется из модуля (runner ищет её в `module.exports`).
4. Прогоните: `./tests/run_tests.sh --dryrun`, затем полностью.

## Соглашения

- **Имена тест-кейсов** — двуязычные: `English Name / Русское описание`
  (английское имя сохраняется как стабильный идентификатор для фильтрации в Robot,
  например `--test "My Feature Works*"`, русское — для читаемости отчётов).
- Один тест-кейс = одна функциональность; граничные случаи — отдельными строками внутри.
- Данные пишутся в коде теста, без внешних файлов-фикстур.
