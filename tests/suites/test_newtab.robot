# Tabula — spreadsheet-style new tab page browser extension.
#
# Copyright (C) 2026 withersky
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

*** Settings ***
Documentation    Юнит-тесты src/lib/core.js (часть newtab): URL, фавиконки, бейджи,
...              ключи сетки, погодные описания, форматирование дат, агрегатор.
Library          ../lib/TabulaCoreLibrary.py

*** Test Cases ***
Normalize Url / Нормализация URL
    Core Function Should Equal    normalizeUrl    https://example.com    example.com
    Core Function Should Equal    normalizeUrl    https://example.com    https://example.com
    Core Function Should Equal    normalizeUrl    http://x.io    http://x.io
    Core Function Should Equal    normalizeUrl    https://x.io    ${SPACE}${SPACE}https://x.io${SPACE}${SPACE}
    Core Function Should Equal    normalizeUrl    chrome://extensions    chrome://extensions
    Core Function Should Equal    normalizeUrl    file:///tmp/a    file:///tmp/a
    Core Function Should Equal    normalizeUrl    \#    ${EMPTY}
    Core Function Should Equal    normalizeUrl    \#    ${None}

Favicon Url / URL фавиконки
    Core Function Should Equal    faviconUrl    https://github.com/favicon.ico    https://github.com/foo
    Core Function Should Equal    faviconUrl    https://github.com/favicon.ico    github.com
    Core Function Should Equal    faviconUrl    http://example.com/favicon.ico    http://example.com/a
    Core Function Should Equal    faviconUrl    https://github.com/favicon.ico    https://github.com:8443/foo
    Core Function Should Equal    faviconUrl    ${EMPTY}    ${EMPTY}
    Core Function Should Equal    faviconUrl    ${EMPTY}    not a url

Favicon Host / Хост фавиконки
    Core Function Should Equal    faviconHost    github.com    https://github.com/foo
    Core Function Should Equal    faviconHost    github.com    github.com
    Core Function Should Equal    faviconHost    example.com    http://example.com
    Core Function Should Equal    faviconHost    sub.domain.co.uk    https://sub.domain.co.uk/x
    Core Function Should Equal    faviconHost    ${EMPTY}    ${EMPTY}
    Core Function Should Equal    faviconHost    ${EMPTY}    not a url

Prune Favicon Cache Max Entries / Обрезка кэша: лимит записей
    Core Function Should Equal    pruneFaviconCache    {"b":{"data":"bb","ts":200},"c":{"data":"cc","ts":300}}    {"a":{"data":"aa","ts":100},"b":{"data":"bb","ts":200},"c":{"data":"cc","ts":300}}    1000    {"maxEntries":2}

Prune Favicon Cache Max Total / Обрезка кэша: суммарный размер
    Core Function Should Equal    pruneFaviconCache    {"b":{"data":"bb","ts":200},"c":{"data":"cccc","ts":300}}    {"a":{"data":"aaaa","ts":100},"b":{"data":"bb","ts":200},"c":{"data":"cccc","ts":300}}    1000    {"maxTotal":6}

Prune Favicon Cache Max Age / Обрезка кэша: возраст записей
    Core Function Should Equal    pruneFaviconCache    {"b":{"data":"bb","ts":200}}    {"a":{"data":"aa","ts":100},"b":{"data":"bb","ts":200}}    1000    {"maxAge":850}
    Core Function Should Equal    pruneFaviconCache    {}    {"a":{"data":"aa","ts":100},"b":{"data":"bb","ts":200}}    1000    {"maxAge":700}

Prune Favicon Cache Edge Cases / Обрезка кэша: невалидные записи
    Core Function Should Equal    pruneFaviconCache    {"d":{"data":"x","ts":0},"b":{"data":"","ts":5},"c":{"data":"","ts":7}}    {"a":null,"b":{"ts":5},"c":{"data":42,"ts":7},"d":{"data":"x","ts":"bad"}}    1000    {}

Prune Favicon Cache Combined And Empty / Обрезка кэша: комбинированные лимиты и пустой кэш
    Core Function Should Equal    pruneFaviconCache    {"b":{"data":"bbbb","ts":200}}    {"a":{"data":"aaaa","ts":100},"b":{"data":"bbbb","ts":200}}    1000    {"maxEntries":1,"maxTotal":100}
    Core Function Should Equal    pruneFaviconCache    {}    {}    1000    {"maxEntries":1}

Letter Char / Буква-заглушка
    Core Function Should Equal    letterChar    G    Google
    Core Function Should Equal    letterChar    G    " google "
    Core Function Should Equal    letterChar    ?    ${EMPTY}
    Core Function Should Equal    letterChar    ?    ${None}
    Core Function Should Equal    letterChar    Ё    ёлка

Key Parts / Разбор ключа ячейки
    Core Function Should Equal    keyParts    [3,7]    3,7
    Core Function Should Equal    keyParts    [0,0]    0,0
    Core Function Should Equal    keyParts    [0,0]    abc
    Core Function Should Equal    keyParts    [42,0]    42

Range Keys / Диапазон ключей
    Core Function Should Equal    rangeKeys    ["0,0","0,1","0,2","1,0","1,1","1,2"]    0,0    1,2
    Core Function Should Equal    rangeKeys    ["0,0","0,1","0,2","1,0","1,1","1,2"]    1,2    0,0
    Core Function Should Equal    rangeKeys    ["0,0"]    0,0    0,0

Next Empty After / Следующая пустая ячейка
    Core Function Should Equal    nextEmptyAfter    0,1    {"cells":{}}    0,0
    Core Function Should Equal    nextEmptyAfter    0,3    {"cells":{"0,1":{},"0,2":{}}}    0,0
    Core Function Should Equal    nextEmptyAfter    1,0    {"cells":{}}    0,5    6
    Core Function Should Equal    nextEmptyAfter    1,0    {"cells":{"0,0":{},"0,1":{},"0,2":{},"0,3":{},"0,4":{},"0,5":{},"0,6":{},"0,7":{}},"columns":8}    0,0

Describe Symbol Russian / Описание символа: русский
    Core Function Should Equal    describeSymbol    Ясно    clearsky_day    ru
    Core Function Should Equal    describeSymbol    Сильная гроза    heavyrainshowersandthunder_night    ru
    Core Function Should Equal    describeSymbol    Небольшой дождь    lightrain_day    ru
    Core Function Should Equal    describeSymbol    Сильный снег    heavysnowshowers_day    ru
    Core Function Should Equal    describeSymbol    unknown_symbol    unknown_symbol    ru

Describe Symbol English And Edge Cases / Описание символа: английский и граничные случаи
    Core Function Should Equal    describeSymbol    Clear    clearsky    en
    Core Function Should Equal    describeSymbol    ${EMPTY}    ${EMPTY}    ru
    Core Function Should Equal    describeSymbol    ${EMPTY}    ${None}    ru

Weather Icon Emoji / Эмодзи погоды
    Core Function Should Equal    weatherIconFor    ☀️    113
    Core Function Should Equal    weatherIconFor    🌧    302
    Core Function Should Equal    weatherIconFor    ❄️    338
    Core Function Should Equal    weatherIconFor    ⛅️    9999
    Core Function Should Equal    weatherIconFor    ⛅️    ${None}

Weather Constants / Константы погоды
    ${e} =    Call Core Function    WEATHER_ICON_EMOJI
    Should Be Equal    ${e}[113]    ☀️
    Should Be Equal    ${e}[302]    🌧
    ${s} =    Call Core Function    SYMBOL_DESC
    Should Be Equal    ${s}[ru][clearsky]    Ясно
    Should Be Equal    ${s}[en][clearsky]    Clear

Format Date Fmt / Форматирование даты
    Core Function Should Equal    formatDateFmt    05.03.2026    {"$date":"2026-03-05T12:00:00"}    dd.mm.yyyy    ru
    Core Function Should Equal    formatDateFmt    05.03.26    {"$date":"2026-03-05T12:00:00"}    dd.mm.yy    ru
    Core Function Should Equal    formatDateFmt    05 Mar    {"$date":"2026-03-05T12:00:00"}    dd.mon    en
    Core Function Should Equal    formatDateFmt    05 March    {"$date":"2026-03-05T12:00:00"}    dd.month    en
    Core Function Should Equal    formatDateFmt    ${EMPTY}    ${None}    dd.mm.yyyy    ru
    Core Function Should Equal    formatDateFmt    ${EMPTY}    {"$date":"2026-03-05T12:00:00"}    off    ru

Aggregator Url With Coords / Агрегатор: по координатам
    Core Function Should Equal    aggregatorUrl    https://yandex.ru/pogoda/ru?lat=56.3286&lon=44.002    56.3286    44.002    ${EMPTY}    ru
    Core Function Should Equal    aggregatorUrl    https://yandex.ru/pogoda/en?lat=56.3286&lon=44.002    56.3286    44.002    ${EMPTY}    en

Aggregator Url By City Name / Агрегатор: по названию города
    Core Function Should Equal    aggregatorUrl    https://yandex.ru/pogoda/search?request=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0    {"$undefined":true}    {"$undefined":true}    Москва    ru
    Core Function Should Equal    aggregatorUrl    https://yandex.ru/pogoda    {"$undefined":true}    {"$undefined":true}    ${EMPTY}    ru

With Timeout Resolves / withTimeout: успех
    Core Function Should Equal    withTimeout    ok    {"$resolve":"ok"}    1000

With Timeout Rejects / withTimeout: отклонение
    ${err} =    Core Function Should Error    withTimeout    {"$reject":"boom"}    1000
    Should Contain    ${err}    boom

With Timeout Fires On Timeout / withTimeout: срабатывание по таймауту
    ${err} =    Core Function Should Error    withTimeout    {"$never":true}    10
    Should Be Equal    ${err}    timeout

Day Label Today Key / Метка дня: сегодня
    Core Function Should Equal    dayLabel    weatherToday    {"$date":"2026-08-10T12:00:00"}    0    ${True}    ru    ${None}

Day Label Weekday Russian / Метка дня: день недели (рус.)
    [Documentation]    2031-01-15 — среда
    Core Function Should Equal    dayLabel    ср    {"$date":"2031-01-15T12:00:00"}    0    ${False}    ru    ${None}

Day Label Weekday English / Метка дня: день недели (англ.)
    [Documentation]    2031-01-15 — среда (Wed)
    Core Function Should Equal    dayLabel    Wed    {"$date":"2031-01-15T12:00:00"}    0    ${False}    en    ${None}
