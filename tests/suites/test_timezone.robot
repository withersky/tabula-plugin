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
Documentation    Юнит-тесты src/lib/timezone.js: единый расчёт часов/дат по
...              таймзоне (partsInTz) и разрешение timezone по имени города
...              через open-meteo (resolveTimezoneByName). Покрывает фикс бага
...              «страна Новая Зеландия показывает UTC»: у стран (feature_code
...              PCLI) поля timezone нет, поэтому resolveTimezoneByName вернёт "".
Library          ../lib/TabulaCoreLibrary.py

*** Test Cases ***
Parts In Tz Auckland Winter / Часы в Окленде (зима, UTC+12)
    [Documentation]    12:00 UTC в Pacific/Auckland (зима) => 00:00, дата +1 день.
    Timezone Function Should Equal    partsInTz    {"hour":0,"minute":0,"weekday":5,"year":2026,"month":7,"day":14,"date":"2026-08-14"}    {"$date":"2026-08-13T12:00:00Z"}    Pacific/Auckland    {"date":true}

Parts In Tz Moscow / Часы в Москве (UTC+3)
    [Documentation]    12:00 UTC в Europe/Moscow => 15:00, та же дата.
    Timezone Function Should Equal    partsInTz    {"hour":15,"minute":0,"weekday":4,"year":2026,"month":7,"day":13,"date":"2026-08-13"}    {"$date":"2026-08-13T12:00:00Z"}    Europe/Moscow    {"date":true}

Parts In Tz Empty Is Local / Пустой пояс = локальное время
    [Documentation]    Пустой tz => используется локальное время устройства (для
    ...                городов без timezone не показываем UTC-сдвиг). Проверка
    ...                TZ-независима: пустой пояс даёт тот же результат, что и
    ...                явный локальный пояс раннера (localTimeZone()).
    ${localTz} =    Timezone Function    localTimeZone
    ${expected} =    Timezone Function    partsInTz    {"$date":"2026-08-13T12:00:00Z"}    ${localTz}    {"date":true}
    Timezone Function Should Equal    partsInTz    ${expected}    {"$date":"2026-08-13T12:00:00Z"}    ${EMPTY}    {"date":true}

Parts In Tz No Date Option / Без date — только часы
    [Documentation]    Если opts.date не задан, поля даты не возвращаются.
    Timezone Function Should Equal    partsInTz    {"hour":15,"minute":0}    {"$date":"2026-08-13T12:00:00Z"}    Europe/Moscow

Resolve City Timezone / Разрешение пояса города
    [Documentation]    open-meteo для города возвращает timezone.
    Timezone Function Should Equal
    ...    resolveTimezoneByName
    ...    Pacific/Auckland
    ...    Окленд
    ...    {"fetchImpl":{"$fetch":{"results":[{"timezone":"Pacific/Auckland"}]}}, "lang":"ru"}

Resolve Country Timezone Empty / Страна без timezone => ""
    [Documentation]    ФИКС БАГА: страны (PCLI) не отдают timezone, поэтому
    ...                resolveTimezoneByName возвращает "" (город не добавится).
    Timezone Function Should Equal
    ...    resolveTimezoneByName
    ...    ${EMPTY}
    ...    Новая Зеландия
    ...    {"fetchImpl":{"$fetch":{"results":[{"feature_code":"PCLI"}]}}}

Resolve Timezone Empty Name / Пустое имя => ""
    [Documentation]    Пустой запрос не ходит в сеть, сразу возвращает "".
    Timezone Function Should Equal    resolveTimezoneByName    ${EMPTY}    ${EMPTY}    {"fetchImpl":{"$fetch":{"results":[]}}}

Resolve Timezone Http Error / HTTP-ошибка геокодера
    [Documentation]    Некорректный ответ геокодера бросает исключение, которое
    ...                ловится в background.js (weatherReverseGeocode).
    ${err} =    Timezone Function Should Error
    ...    resolveTimezoneByName
    ...    X
    ...    {"fetchImpl":{"$fetch":{"error":500}}}
    Should Contain    ${err}    geocoder http 500

Parts In Tz Gecko No Leading Zero / Firefox: YYYY-MM-DD без ведущих нулей
    [Documentation]    ФИКС БАГА: Gecko/Firefox для month/day "2-digit" НЕ
    ...                добавляет ведущий ноль (возвращает "8", а не "08"). Без
    ...                нормализации out.date получался бы "2026-8-14", что
    ...                ломало лексические сравнения дат в buildDailyForecast/
    ...                buildHourlyForecast и new Date(day.date + "T12:00:00")
    ...                → Invalid Date → прогноз погоды для восточных поясов
    ...                (UTC+12..+14, «уже следующий день») не рендерился
    ...                («не удалось получить прогноз» на Firefox). Под симуляцией
    ...                Gecko дата всё равно должна быть строго YYYY-MM-DD.
    Timezone Function Should Equal
    ...    partsInTz
    ...    {"hour":2,"minute":0,"weekday":5,"year":2026,"month":7,"day":14,"date":"2026-08-14"}
    ...    {"$date":"2026-08-13T12:00:00Z","$gecko":true}
    ...    Pacific/Kiritimati
    ...    {"date":true}

Parts In Tz Gecko Single Digit Month Day / Firefox: однозначные месяц/день
    [Documentation]    Под симуляцией Gecko для даты вроде 2026-03-05 (однозначные
    ...                месяц и день) partsInTz обязан вернуть "2026-03-05", а не
    ...                "2026-3-5". Проверка фикса для городов с «обычным» поясом.
    Timezone Function Should Equal
    ...    partsInTz
    ...    {"hour":15,"minute":0,"weekday":5,"year":2026,"month":2,"day":13,"date":"2026-03-13"}
    ...    {"$date":"2026-03-13T12:00:00Z","$gecko":true}
    ...    Europe/Moscow
    ...    {"date":true}
