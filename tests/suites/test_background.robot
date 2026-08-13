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
Documentation    Юнит-тесты src/lib/core.js (часть background): маппинг символов
...              met.no -> коды WWO, num(), свёртка прогноза по дням.
Library          ../lib/TabulaCoreLibrary.py

*** Test Cases ***
Symbol To Code Basics / Символ в код: основы
    Core Function Should Equal    symbolToCode    113    clearsky_day
    Core Function Should Equal    symbolToCode    116    fair
    Core Function Should Equal    symbolToCode    116    partlycloudy_night
    Core Function Should Equal    symbolToCode    302    heavyrain_polartwilight
    Core Function Should Equal    symbolToCode    176    lightrainshowers_day
    Core Function Should Equal    symbolToCode    200    rainshowersandthunder_night
    Core Function Should Equal    symbolToCode    392    snowandthunder_day

Symbol To Code Edge Cases / Символ в код: граничные случаи
    Core Function Should Equal    symbolToCode    ${None}    unknown_symbol
    Core Function Should Equal    symbolToCode    ${None}    ${EMPTY}
    Core Function Should Equal    symbolToCode    ${None}    ${None}
    Core Function Should Equal    symbolToCode    ${None}    123

Num Parsing / Разбор чисел
    Core Function Should Equal    num    42    42
    Core Function Should Equal    num    42    "42"
    Core Function Should Equal    num    3.14    "3.14"
    Core Function Should Equal    num    -7    "-7"
    Core Function Should Equal    num    ${None}    abc
    Core Function Should Equal    num    0    ${EMPTY}
    Core Function Should Equal    num    0    ${None}
    Core Function Should Equal    num    ${None}    {"$undefined":true}

Build Daily Forecast Empty / Прогноз по дням: пустой ввод
    Core Function Should Equal    buildDailyForecast    []    []    ru
    Core Function Should Equal    buildDailyForecast    []    [{"time":"not-a-date"}]    ru

Build Daily Forecast Single Day / Прогноз по дням: один день
    [Documentation]    Символ на 12:00 побеждает, min/max округляются
    ${ts} =    Set Variable    [{"time":"2026-03-05T09:00:00+03:00","data":{"instant":{"details":{"air_temperature":10.2}},"next_1_hours":{"summary":{"symbol_code":"partlycloudy_day"}}}},{"time":"2026-03-05T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":15.8}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}},{"time":"2026-03-05T18:00:00+03:00","data":{"instant":{"details":{"air_temperature":8.4}},"next_6_hours":{"summary":{"symbol_code":"cloudy_night"}}}}]
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-03-05","minC":8,"maxC":16,"symbol":"clearsky_day","code":113,"desc":"clearsky_day"}]    ${ts}    ru

Build Daily Forecast Two Days / Прогноз по дням: два дня
    ${ts} =    Set Variable    [{"time":"2026-03-05T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":10}},"next_1_hours":{"summary":{"symbol_code":"partlycloudy_day"}}}},{"time":"2026-03-06T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":-3.4}},"next_1_hours":{"summary":{"symbol_code":"snow_day"}}}}]
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-03-05","minC":10,"maxC":10,"symbol":"partlycloudy_day","code":116,"desc":"partlycloudy_day"},{"date":"2026-03-06","minC":-3,"maxC":-3,"symbol":"snow_day","code":332,"desc":"snow_day"}]    ${ts}    ru

Build Daily Forecast Heavy Symbol / Прогноз по дням: сильная погода
    ${ts} =    Set Variable    [{"time":"2026-03-05T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":5}},"next_1_hours":{"summary":{"symbol_code":"heavyrain_night"}}}}]
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-03-05","minC":5,"maxC":5,"symbol":"heavyrain_night","code":302,"desc":"heavyrain_night"}]    ${ts}    ru

Build Daily Forecast Missing Data / Прогноз по дням: нет данных
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-03-05","minC":null,"maxC":null,"symbol":null,"code":null,"desc":"Погода"}]    [{"time":"2026-03-05T12:00:00+03:00"}]    ru
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-03-05","minC":null,"maxC":null,"symbol":null,"code":null,"desc":"Weather"}]    [{"time":"2026-03-05T12:00:00+03:00"}]    en

Build Daily Forecast Prefers Noon Symbol / Прогноз по дням: приоритет символа 12:00
    ${ts} =    Set Variable    [{"time":"2026-03-05T09:00:00+03:00","data":{"instant":{"details":{"air_temperature":1}},"next_1_hours":{"summary":{"symbol_code":"rain_day"}}}},{"time":"2026-03-05T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":2}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}}]
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-03-05","minC":1,"maxC":2,"symbol":"clearsky_day","code":113,"desc":"clearsky_day"}]    ${ts}    ru

Build Hourly Forecast Empty / Почасовой прогноз: пустой ввод
    Core Function Should Equal    buildHourlyForecast    []    []
    Core Function Should Equal    buildHourlyForecast    []    [{"time":"not-a-date"}]
    Core Function Should Equal    buildHourlyForecast    []    [{"time":"2026-03-05T12:00:00+03:00"}]

Build Hourly Forecast Single / Почасовой прогноз: одна точка
    ${ts} =    Set Variable    [{"time":"2026-03-05T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":15.8}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}}]
    Core Function Should Equal    buildHourlyForecast    [{"date":"2026-03-05","hour":12,"tempC":16,"symbol":"clearsky_day","code":113,"desc":"clearsky_day"}]    ${ts}    ru

Build Hourly Forecast Limit / Почасовой прогноз: ограничение числа точек
    ${ts} =    Set Variable    [{"time":"2026-03-05T09:00:00+03:00","data":{"instant":{"details":{"air_temperature":10.2}},"next_1_hours":{"summary":{"symbol_code":"partlycloudy_day"}}}},{"time":"2026-03-05T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":15.8}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}},{"time":"2026-03-05T18:00:00+03:00","data":{"instant":{"details":{"air_temperature":8.4}},"next_6_hours":{"summary":{"symbol_code":"cloudy_night"}}}}]
    Core Function Should Equal    buildHourlyForecast    [{"date":"2026-03-05","hour":9,"tempC":10,"symbol":"partlycloudy_day","code":116,"desc":"partlycloudy_day"},{"date":"2026-03-05","hour":12,"tempC":16,"symbol":"clearsky_day","code":113,"desc":"clearsky_day"}]    ${ts}    ru    2

Build Hourly Forecast Next6Hours Fallback / Почасовой прогноз: символ из next_6_hours
    ${ts} =    Set Variable    [{"time":"2026-03-05T18:00:00+03:00","data":{"instant":{"details":{"air_temperature":8.4}},"next_6_hours":{"summary":{"symbol_code":"cloudy_night"}}}}]
    Core Function Should Equal    buildHourlyForecast    [{"date":"2026-03-05","hour":18,"tempC":8,"symbol":"cloudy_night","code":119,"desc":"cloudy_night"}]    ${ts}    ru

Build Hourly Forecast Skips Missing Temp / Почасовой прогноз: пропуск без температуры
    ${ts} =    Set Variable    [{"time":"2026-03-05T09:00:00+03:00"},{"time":"2026-03-05T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":1}},"next_1_hours":{"summary":{"symbol_code":"rain_day"}}}}]
    Core Function Should Equal    buildHourlyForecast    [{"date":"2026-03-05","hour":12,"tempC":1,"symbol":"rain_day","code":296,"desc":"rain_day"}]    ${ts}    ru

Build Hourly Forecast UTC+12 Local Time / Почасовой прогноз: пояс восточнее UTC
    [Documentation]    Регресс: для города UTC+12 (Южная Тарава) прогноз должен
    ...                начинаться с МЕСТНОГО часа (01:00 при UTC 13:05), а не с UTC
    ...                (13:00). Раньше из-за рассинхрона tz виджет показывал 13:00
    ...                вместо 01:00 и два «Сегодня». Якорь «сейчас» зафиксирован
    ...                (now=2026-08-13T13:05Z), чтобы тест был детерминированным.
    ${ts} =    Set Variable    [{"time":"2026-08-13T13:00:00Z","data":{"instant":{"details":{"air_temperature":25}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}},{"time":"2026-08-13T14:00:00Z","data":{"instant":{"details":{"air_temperature":25}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}},{"time":"2026-08-14T00:00:00Z","data":{"instant":{"details":{"air_temperature":25}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}},{"time":"2026-08-14T01:00:00Z","data":{"instant":{"details":{"air_temperature":25}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}}]
    # Без tz — UTC (13:00). С tz — местное (01:00 следующего дня).
    Core Function Should Equal    buildHourlyForecast    [{"date":"2026-08-13","hour":13,"tempC":25,"symbol":"clearsky_day","code":113,"desc":"clearsky_day"}]    ${ts}    ru    1    ${EMPTY}    {"$date":"2026-08-13T13:05:00Z"}
    Core Function Should Equal    buildHourlyForecast    [{"date":"2026-08-14","hour":1,"tempC":25,"symbol":"clearsky_day","code":113,"desc":"clearsky_day"}]    ${ts}    ru    1    Pacific/Tarawa    {"$date":"2026-08-13T13:05:00Z"}

Build Daily Forecast UTC+12 Single Day / Прогноз по дням: пояс восточнее UTC
    [Documentation]    Регресс: для UTC+12 «сегодня» — 2026-08-14, а не 2026-08-13 (UTC).
    ...                Проверяет, что дневной прогноз строится в местном поясе и не
    ...                возникает двух «Сегодня» из-за рассинхрона дат. Якорь
    ...                «сейчас» зафиксирован (now=2026-08-13T13:05Z).
    ${ts} =    Set Variable    [{"time":"2026-08-13T13:00:00Z","data":{"instant":{"details":{"air_temperature":25}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}},{"time":"2026-08-14T01:00:00Z","data":{"instant":{"details":{"air_temperature":20}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}}]
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-08-14","minC":20,"maxC":25,"symbol":"clearsky_day","code":113,"desc":"clearsky_day"}]    ${ts}    ru    Pacific/Tarawa    {"$date":"2026-08-13T13:05:00Z"}

Build Daily Forecast Gecko Eastern Tz Not Lost / Firefox: восточный пояс не теряется
    [Documentation]    ФИКС БАГА (Firefox): под симуляцией Gecko (month/day без
    ...                ведущих нулей) дневной прогноз для восточного пояса UTC+14
    ...                (Pacific/Kiritimati) при UTC 2026-08-13T12:00Z должен
    ...                корректно построиться на 2026-08-14 (местное «завтра») и НЕ
    ...                быть отфильтрован как «прошедший» из-за кривой строки даты
    ...                "2026-8-14". До фикса out.date был "2026-8-14" → сравнение
    ...                дат ломалось → прогноз пустой («не удалось получить прогноз»).
    ...                Якорь «сейчас» зафиксирован (now=2026-08-13T12:00Z).
    ${ts} =    Set Variable    [{"time":"2026-08-13T12:00:00Z","data":{"instant":{"details":{"air_temperature":25}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}},{"time":"2026-08-14T02:00:00Z","data":{"instant":{"details":{"air_temperature":20}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}}]
    Core Function Should Equal
    ...    buildDailyForecast
    ...    [{"date":"2026-08-14","minC":20,"maxC":25,"symbol":"clearsky_day","code":113,"desc":"clearsky_day"}]
    ...    ${ts}
    ...    ru
    ...    Pacific/Kiritimati
    ...    {"$date":"2026-08-13T12:00:00Z","$gecko":true}

Build Hourly Forecast Gecko Eastern Tz / Firefox: почасовой восточный пояс
    [Documentation]    Под симуляцией Gecko для UTC+14 почасовой прогноз должен
    ...                начаться с местного часа (02:00 при UTC 12:00) и дать дату
    ...                "2026-08-14" (а не "2026-8-14"). Проверка фикса рендера
    ...                почасовой ленты на Firefox. Якорь now=2026-08-13T12:00Z.
    ${ts} =    Set Variable    [{"time":"2026-08-13T12:00:00Z","data":{"instant":{"details":{"air_temperature":25}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}},{"time":"2026-08-13T13:00:00Z","data":{"instant":{"details":{"air_temperature":25}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}},{"time":"2026-08-14T02:00:00Z","data":{"instant":{"details":{"air_temperature":25}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}}]
    Core Function Should Equal    buildHourlyForecast    [{"date":"2026-08-14","hour":2,"tempC":25,"symbol":"clearsky_day","code":113,"desc":"clearsky_day"}]    ${ts}    ru    1    Pacific/Kiritimati    {"$date":"2026-08-13T12:00:00Z","$gecko":true}
