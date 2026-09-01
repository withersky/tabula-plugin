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

Format Date Fmt Custom / Кастомный шаблон даты
    Core Function Should Equal    formatDateFmt    15.08.2026    {"$date":"2026-08-15T12:00:00"}    custom:DD.MM.YYYY    ru
    Core Function Should Equal    formatDateFmt    5 авг    {"$date":"2026-08-05T12:00:00"}    custom:D MMM    ru
    Core Function Should Equal    formatDateFmt    05.08.26    {"$date":"2026-08-05T12:00:00"}    custom:DD.MM.YY    ru
    Core Function Should Equal    formatDateFmt    2026-08-05    {"$date":"2026-08-05T12:00:00"}    custom:YYYY-MM-DD    ru
    Core Function Should Equal    formatDateFmt    5 August    {"$date":"2026-08-05T12:00:00"}    custom:D MMMM    en

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

Is Group Cell / Проверка типа группы
    Core Function Should Equal    isGroupCell    ${True}    {"id":"x","type":"group"}
    Core Function Should Equal    isGroupCell    ${False}    {"id":"x","title":"G","url":"https://g"}
    Core Function Should Equal    isGroupCell    ${False}    ${None}
    Core Function Should Equal    isGroupCell    ${False}    {}

Insert Group Row / Вставка строки разделителя
    [Documentation]    insertGroupRow ставит разделитель в колонку 0, сохраняя данные.
    ...                Если строка row уже занята закладкой, ячейки с r >= row
    ...                сдвигаются на строку вниз; если строка пуста — сдвига нет.
    ...                Разделитель не занимает строку закладок (см. computeFillRows).
    Core Function Should Equal    insertGroupRow    {"0,0":{"id":"a","title":"A","url":"https://a"},"0,1":{"id":"b","title":"B","url":"https://b"},"1,0":{"id":"g","title":"Group","type":"group"}}    {"0,0":{"id":"a","title":"A","url":"https://a"},"0,1":{"id":"b","title":"B","url":"https://b"}}    1    {"id":"g","title":"Group","type":"group"}
    Core Function Should Equal    insertGroupRow    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,0":{"id":"g","title":"Group","type":"group"},"2,0":{"id":"b","title":"B","url":"https://b"}}    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,0":{"id":"b","title":"B","url":"https://b"}}    1    {"id":"g","title":"Group","type":"group"}
    # Вставка в строку с занятой другой колонкой: (1,0) пуста, (1,1) занята —
    # закладка сдвигается вниз, чтобы разделитель её не перекрыл.
    Core Function Should Equal    insertGroupRow    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,0":{"id":"g","title":"Group","type":"group"},"2,1":{"id":"b","title":"B","url":"https://b"}}    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,1":{"id":"b","title":"B","url":"https://b"}}    1    {"id":"g","title":"Group","type":"group"}

Move Group Row / Перемещение строки разделителя
    [Documentation]    moveGroupRow убирает группу с fromRow, сдвигает промежуточные
    ...                строки и вставляет разделитель на toRow, не теряя данные.
    Core Function Should Equal    moveGroupRow    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,0":{"id":"b","title":"B","url":"https://b"},"2,0":{"id":"c","title":"C","url":"https://c"},"3,0":{"id":"d","title":"D","url":"https://d"},"4,0":{"id":"e","title":"E","url":"https://e"},"5,0":{"id":"g","title":"Group","type":"group"},"6,0":{"id":"f","title":"F","url":"https://f"}}    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,0":{"id":"b","title":"B","url":"https://b"},"2,0":{"id":"g","title":"Group","type":"group"},"3,0":{"id":"c","title":"C","url":"https://c"},"4,0":{"id":"d","title":"D","url":"https://d"},"5,0":{"id":"e","title":"E","url":"https://e"},"6,0":{"id":"f","title":"F","url":"https://f"}}    2    5
    Core Function Should Equal    moveGroupRow    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,0":{"id":"g","title":"Group","type":"group"},"2,0":{"id":"b","title":"B","url":"https://b"},"3,0":{"id":"c","title":"C","url":"https://c"}}    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,0":{"id":"b","title":"B","url":"https://b"},"2,0":{"id":"g","title":"Group","type":"group"},"3,0":{"id":"c","title":"C","url":"https://c"}}    2    1
    Core Function Should Equal    moveGroupRow    {"0,0":{"id":"a","title":"A","url":"https://a"},"2,0":{"id":"g","title":"Group","type":"group"}}    {"0,0":{"id":"a","title":"A","url":"https://a"},"2,0":{"id":"g","title":"Group","type":"group"}}    2    2
    Core Function Should Equal    moveGroupRow    {"0,0":{"id":"a","title":"A","url":"https://a"}}    {"0,0":{"id":"a","title":"A","url":"https://a"}}    0    2

Remove Group Row / Удаление строки разделителя
    [Documentation]    removeGroupRow убирает группу с row и поднимает все ячейки
    ...                с r > row на строку вверх. Инвариант: инверсная пара с
    ...                insertGroupRow (для занятой и пустой строки).
    Core Function Should Equal    removeGroupRow    {}    {}    0
    # Инверс: insertGroupRow в занятую строку (1,1) → removeGroupRow → исходные данные.
    Core Function Should Equal    removeGroupRow    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,1":{"id":"b","title":"B","url":"https://b"}}    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,0":{"id":"g","title":"Group","type":"group"},"2,1":{"id":"b","title":"B","url":"https://b"}}    1
    # Инверс: insertGroupRow в пустую строку (нет сдвига).
    Core Function Should Equal    removeGroupRow    {"0,0":{"id":"a","title":"A","url":"https://a"}}    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,0":{"id":"g","title":"Group","type":"group"}}    1
    # Удаление сдвигает содержимое ниже: group на 1, b ниже на 1 → b на 1.
    Core Function Should Equal    removeGroupRow    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,0":{"id":"b","title":"B","url":"https://b"}}    {"0,0":{"id":"a","title":"A","url":"https://a"},"1,0":{"id":"g","title":"Group","type":"group"},"2,0":{"id":"b","title":"B","url":"https://b"}}    1
    # Если в row нет группы — без изменений.
    Core Function Should Equal    removeGroupRow    {"0,0":{"id":"a","title":"A","url":"https://a"}}    {"0,0":{"id":"a","title":"A","url":"https://a"}}    0

Sort Sheet Cells By Title / Сортировка закладок по названию
    [Documentation]    sortSheetCells упаковывает закладки влево-вверх построчно.
    Core Function Should Equal    sortSheetCells    {"0,0":{"id":"a","title":"A","url":"https://a"},"0,1":{"id":"z","title":"Z","url":"https://z"}}    {"0,0":{"id":"z","title":"Z","url":"https://z"},"0,1":{"id":"a","title":"A","url":"https://a"}}    2    title
    Core Function Should Equal    sortSheetCells    {"0,0":{"id":"a","title":"A","url":"https://a"},"0,1":{"id":"z","title":"Z","url":"https://z"}}    {"0,2":{"id":"z","title":"Z","url":"https://z"},"1,1":{"id":"a","title":"A","url":"https://a"}}    3    title

Sort Sheet Cells With Groups / Сортировка закладок с группами
    [Documentation]    Разделители остаются на своих местах, закладки внутри секций
    ...                сортируются; «мусор» в строках-группах сохраняется.
    Core Function Should Equal    sortSheetCells    {"0,0":{"id":"g","title":"Sec1","type":"group"},"1,0":{"id":"a","title":"A","url":"https://a"},"1,1":{"id":"b","title":"B","url":"https://b"}}    {"0,0":{"id":"g","title":"Sec1","type":"group"},"1,0":{"id":"b","title":"B","url":"https://b"},"1,1":{"id":"a","title":"A","url":"https://a"}}    2    title
    Core Function Should Equal    sortSheetCells    {"0,0":{"id":"g","title":"Sec","type":"group"},"0,2":{"id":"x","title":"X","url":"https://x"},"1,0":{"id":"a","title":"A","url":"https://a"},"1,1":{"id":"b","title":"B","url":"https://b"}}    {"0,0":{"id":"g","title":"Sec","type":"group"},"0,2":{"id":"x","title":"X","url":"https://x"},"1,0":{"id":"b","title":"B","url":"https://b"},"1,1":{"id":"a","title":"A","url":"https://a"}}    3    title

Sort Sheet Cells By Domain / Сортировка закладок по домену
    [Documentation]    Сравнение идёт по домену (без www), при равенстве — по названию.
    Core Function Should Equal    sortSheetCells    {"0,0":{"id":"b","title":"B","url":"https://apple.com"},"0,1":{"id":"a","title":"A","url":"https://www.zebra.io"}}    {"0,0":{"id":"a","title":"A","url":"https://www.zebra.io"},"0,1":{"id":"b","title":"B","url":"https://apple.com"}}    2    domain

Host Of / Домен без www
    Core Function Should Equal    hostOf    zebra.io    https://www.zebra.io/a
    Core Function Should Equal    hostOf    example.com    example.com
    Core Function Should Equal    hostOf    ${EMPTY}    ${EMPTY}

Today Key / Ключ даты «сегодня»
    [Documentation]    todayKey(d) возвращает 'YYYY-MM-DD' для переданной даты;
    ...                без аргумента — текущую дату устройства (формат тот же).
    Core Function Should Equal    todayKey    2026-03-05    {"$date":"2026-03-05T12:00:00"}
    Core Function Should Equal    todayKey    2026-12-31    {"$date":"2026-12-31T23:59:59"}
    Core Function Should Equal    todayKey    2026-01-01    {"$date":"2026-01-01T00:00:00"}
    # Дата без аргумента — реальные часы, формат YYYY-MM-DD.
    ${k} =    Call Core Function    todayKey
    Should Match Regexp    ${k}    ^\\d{4}-\\d{2}-\\d{2}$

Pick For Date / Выбор обоев по дате (детерминизм)
    [Documentation]    pickForDate(list, dateKey) — детерминированный выбор: одна и та же
    ...                дата всегда даёт один и тот же элемент из списка.
    Core Function Should Equal    pickForDate    url-a    ["url-a","url-b","url-c"]    2026-03-05
    Core Function Should Equal    pickForDate    url-a    ["url-a","url-b","url-c"]    2026-03-05
    Core Function Should Equal    pickForDate    url-b    ["url-a","url-b","url-c"]    2026-03-06
    Core Function Should Equal    pickForDate    url-c    ["url-a","url-b","url-c"]    2026-03-07

Pick For Date Edge Cases / Выбор обоев: граничные случаи
    [Documentation]    Пустой список/не-массив возвращают пустую строку; одинарный
    ...                элемент — всегда он; выбор ограничен длиной списка.
    Core Function Should Equal    pickForDate    ${EMPTY}    []    2026-03-05
    Core Function Should Equal    pickForDate    ${EMPTY}    ${None}    2026-03-05
    Core Function Should Equal    pickForDate    only    ["only"]    2026-03-05
    Core Function Should Equal    pickForDate    only    ["only"]    2026-12-31
    Core Function Should Equal    pickForDate    a    ["a"]    2026-03-05

Macos Wallpaper Title / Название обоев из URL
    [Documentation]    macosWallpaperTitle вытаскивает слаг из ссылки на оригинал:
    ...                /wallpapers/<slug>--<id>.jpg → название словами.
    Core Function Should Equal    macosWallpaperTitle    macos big sur    https://4kwallpapers.com/images/wallpapers/macos-big-sur--1234.jpg
    Core Function Should Equal    macosWallpaperTitle    macos ventura night    https://4kwallpapers.com/images/wallpapers/macos-ventura-night--5678.png
    Core Function Should Equal    macosWallpaperTitle    ${EMPTY}    ${EMPTY}
    Core Function Should Equal    macosWallpaperTitle    ${EMPTY}    ${None}
    Core Function Should Equal    macosWallpaperTitle    ${EMPTY}    https://4kwallpapers.com/images/wallpapers/macos-big-sur-1920x1080-1234.jpg
