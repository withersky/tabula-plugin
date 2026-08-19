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

Day Label Tomorrow In City Tz / Метка дня: «Завтра» в поясе города
    [Documentation]    Регресс: для восточного пояса (UTC+12, Южная Тарава) второй день
    ...                прогноза — это городское «завтра», хотя по часам пользователя
    ...                (Москва, UTC+3) это уже другая дата. Раньше метка показывала
    ...                день недели вместо «Завтра». Якорь «сейчас» передаётся 7-м
    ...                аргументом (now) и зафиксирован (2026-08-13T13:05Z): в Tarawa
    ...                это 2026-08-14, завтра — 2026-08-15. Без фиксации now тест
    ...                протухал от реальных часов.
    Core Function Should Equal    dayLabel    weatherTomorrow    {"$date":"2026-08-15T12:00:00+12:00"}    1    ${False}    ru    ${None}    Pacific/Tarawa    {"$date":"2026-08-13T13:05Z"}
    # Без tz — старое поведение по локальному времени устройства (детерминизма нет,
    # но для совместимости оставляем ветку без tz). Якорь now зафиксирован, чтобы
    # tomorrowKey не зависел от реальных часов (2031-01-18 → суббота «сб»).
    Core Function Should Equal    dayLabel    сб    {"$date":"2031-01-18T12:00:00"}    0    ${False}    ru    ${None}    ${None}    {"$date":"2031-01-18T00:00:00"}

Day Label Tomorrow Honolulu West Tz / Метка дня: «Завтра» для западного пояса (Гонолулу)
    [Documentation]    РЕГРЕСС БАГА: устройство (Москва) = 2026-08-18 09:00 по
    ...                месту (UTC+3 => 06:00Z). В Гонолулу (Pacific/Honolulu, UTC-10)
    ...                это 2026-08-17 20:00 — «сегодня» = 17.08, «завтра» = 18.08.
    ...                Второй день прогноза (day.date="2026-08-18") ДОЛЖЕН показывать
    ...                «Завтра», а не имя дня недели «вт». Раньше строка day.date
    ...                интерпретировалась как локальное время устройства (Москва):
    ...                12:00 Москвы = вечер 17.08 в Гонолулу => dayKey сдвигался на
    ...                день назад и «Завтра» ломалось. Теперь day.date передаётся как
    ...                городская дата напрямую. Якорь now зафиксирован, чтобы тест не
    ...                зависел от реальных часов.
    Core Function Should Equal    dayLabel    weatherTomorrow    "2026-08-18"    1    ${False}    ru    ${None}    Pacific/Honolulu    {"$date":"2026-08-18T09:00:00+03:00"}
    # Строковая дата без пояса устройства: day.date="2026-08-18" в Гонолулу при
    # «сейчас»=18.08 (день прогноза совпадает с городским завтра) => «Завтра».
    Core Function Should Equal    dayLabel    weatherTomorrow    "2026-08-18"    1    ${False}    en    ${None}    Pacific/Honolulu    {"$date":"2026-08-18T06:00:00Z"}

Day Label Tomorrow Honolulu Weekday Not Leaking / Метка дня: Гонолулу не «течёт» именем дня
    [Documentation]    Проверка, что для западного пояса метка не подменяется именем
    ...                дня недели. При том же якоре (Москва 2026-08-18 09:00 =>
    ...                Гонолулу 17.08 20:00) день прогноза 18.08 — это городское
    ...                «завтра», поэтому НЕ «вт»/«Tue». Это и есть суть бага: раньше
    ...                возвращалось «вт»/«Tue». Проверяем прямым равенством с
    ...                «Завтра»/«Tomorrow» (обратный случай покрыт тем, что слово
    ...                «вт»/«Tue» здесь не возвращается).
    Core Function Should Equal    dayLabel    weatherTomorrow    "2026-08-18"    1    ${False}    ru    ${None}    Pacific/Honolulu    {"$date":"2026-08-18T09:00:00+03:00"}
    Core Function Should Equal    dayLabel    weatherTomorrow    "2026-08-18"    1    ${False}    en    ${None}    Pacific/Honolulu    {"$date":"2026-08-18T09:00:00+03:00"}

Today Hourly Key Midnight Crossing / Ключ «сегодня» почасовки: переход через полночь
    [Documentation]    РЕГРЕСС БАГА: на востоке (Южная Тарава, UTC+12) при 23:00
    ...                прогноз начинается с 23:00 текущего дня, а следующие часы —
    ...                00:00 и далее УЖЕ следующего дня. Раньше «сегодня» считалось
    ...                от new Date() в момент рендера попапа: первый час
    ...                (уже вчерашний по городу) подсвечивался «сегодня» через
    ...                idx===0, а весь новый день — через совпадение с todayKey =>
    ...                ДВА «Сегодня» и синий следующий день. Теперь todayHourlyKey
    ...                берёт дату ПЕРВОГО часа прогноза, поэтому для списка
    ...                [23:00 2026-08-15, 00:00 2026-08-16, 01:00 2026-08-16, ...]
    ...                ключ — «2026-08-15» (а НЕ «2026-08-16»). Это и есть фикс:
    ...                сегодня ровно тот день, с которого начат прогноз.
    Core Function Should Equal    todayHourlyKey    2026-08-15    [{"date":"2026-08-15","hour":23,"code":1,"tempC":20},{"date":"2026-08-16","hour":0,"code":1,"tempC":19},{"date":"2026-08-16","hour":1,"code":2,"tempC":19},{"date":"2026-08-16","hour":2,"code":3,"tempC":18}]

Today Hourly Key West Tz / Ключ «сегодня» почасовки: западный пояс (Гонолулу)
    [Documentation]    Зеркальный случай для запада (Гонолулу, UTC-10): прогноз
    ...                тоже может начинаться с позднего часа и перейти через
    ...                полночь. Ключ «сегодня» должен быть датой первого часа,
    ...                а не следующего дня.
    Core Function Should Equal    todayHourlyKey    2026-08-17    [{"date":"2026-08-17","hour":20,"code":1,"tempC":25},{"date":"2026-08-17","hour":21,"code":1,"tempC":24},{"date":"2026-08-18","hour":0,"code":2,"tempC":23},{"date":"2026-08-18","hour":1,"code":3,"tempC":23}]

Today Hourly Key Same Day / Ключ «сегодня» почасовки: всё в одном дне
    [Documentation]    Обычный случай без перехода через полночь: все часы
    ...                одного дня — ключ равен этой дате.
    Core Function Should Equal    todayHourlyKey    2026-08-19    [{"date":"2026-08-19","hour":9,"code":1,"tempC":15},{"date":"2026-08-19","hour":10,"code":1,"tempC":16},{"date":"2026-08-19","hour":11,"code":2,"tempC":17}]

Today Hourly Key Edge Cases / Ключ «сегодня» почасовки: пустой/без даты
    [Documentation]    Крайние случаи: пустой список и список без поля date
    ...                должны давать null (никакой подсветки «сегодня»).
    Core Function Should Equal    todayHourlyKey    ${None}    []
    Core Function Should Equal    todayHourlyKey    ${None}    [{"hour":23,"code":1}]
