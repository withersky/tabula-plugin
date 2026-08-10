*** Settings ***
Documentation    Юнит-тесты lib/core.js (часть background): маппинг символов
...              met.no -> коды WWO, num(), свёртка прогноза по дням.
Library          ../lib/TabulaCoreLibrary.py

*** Test Cases ***
Symbol To Code Basics
    Core Function Should Equal    symbolToCode    113    clearsky_day
    Core Function Should Equal    symbolToCode    116    fair
    Core Function Should Equal    symbolToCode    116    partlycloudy_night
    Core Function Should Equal    symbolToCode    302    heavyrain_polartwilight
    Core Function Should Equal    symbolToCode    176    lightrainshowers_day
    Core Function Should Equal    symbolToCode    200    rainshowersandthunder_night
    Core Function Should Equal    symbolToCode    392    snowandthunder_day

Symbol To Code Edge Cases
    Core Function Should Equal    symbolToCode    ${None}    unknown_symbol
    Core Function Should Equal    symbolToCode    ${None}    ${EMPTY}
    Core Function Should Equal    symbolToCode    ${None}    ${None}
    Core Function Should Equal    symbolToCode    ${None}    123

Num Parsing
    Core Function Should Equal    num    42    42
    Core Function Should Equal    num    42    "42"
    Core Function Should Equal    num    3.14    "3.14"
    Core Function Should Equal    num    -7    "-7"
    Core Function Should Equal    num    ${None}    abc
    Core Function Should Equal    num    0    ${EMPTY}
    Core Function Should Equal    num    0    ${None}
    Core Function Should Equal    num    ${None}    {"$undefined":true}

Build Daily Forecast Empty
    Core Function Should Equal    buildDailyForecast    []    []    ru
    Core Function Should Equal    buildDailyForecast    []    [{"time":"not-a-date"}]    ru

Build Daily Forecast Single Day
    [Documentation]    Символ на 12:00 побеждает, min/max округляются
    ${ts} =    Set Variable    [{"time":"2026-03-05T09:00:00+03:00","data":{"instant":{"details":{"air_temperature":10.2}},"next_1_hours":{"summary":{"symbol_code":"partlycloudy_day"}}}},{"time":"2026-03-05T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":15.8}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}},{"time":"2026-03-05T18:00:00+03:00","data":{"instant":{"details":{"air_temperature":8.4}},"next_6_hours":{"summary":{"symbol_code":"cloudy_night"}}}}]
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-03-05","minC":8,"maxC":16,"symbol":"clearsky_day","code":113,"desc":"clearsky_day"}]    ${ts}    ru

Build Daily Forecast Two Days
    ${ts} =    Set Variable    [{"time":"2026-03-05T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":10}},"next_1_hours":{"summary":{"symbol_code":"partlycloudy_day"}}}},{"time":"2026-03-06T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":-3.4}},"next_1_hours":{"summary":{"symbol_code":"snow_day"}}}}]
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-03-05","minC":10,"maxC":10,"symbol":"partlycloudy_day","code":116,"desc":"partlycloudy_day"},{"date":"2026-03-06","minC":-3,"maxC":-3,"symbol":"snow_day","code":332,"desc":"snow_day"}]    ${ts}    ru

Build Daily Forecast Heavy Symbol
    ${ts} =    Set Variable    [{"time":"2026-03-05T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":5}},"next_1_hours":{"summary":{"symbol_code":"heavyrain_night"}}}}]
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-03-05","minC":5,"maxC":5,"symbol":"heavyrain_night","code":302,"desc":"heavyrain_night"}]    ${ts}    ru

Build Daily Forecast Missing Data
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-03-05","minC":null,"maxC":null,"symbol":null,"code":null,"desc":"Погода"}]    [{"time":"2026-03-05T12:00:00+03:00"}]    ru
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-03-05","minC":null,"maxC":null,"symbol":null,"code":null,"desc":"Weather"}]    [{"time":"2026-03-05T12:00:00+03:00"}]    en

Build Daily Forecast Prefers Noon Symbol
    ${ts} =    Set Variable    [{"time":"2026-03-05T09:00:00+03:00","data":{"instant":{"details":{"air_temperature":1}},"next_1_hours":{"summary":{"symbol_code":"rain_day"}}}},{"time":"2026-03-05T12:00:00+03:00","data":{"instant":{"details":{"air_temperature":2}},"next_1_hours":{"summary":{"symbol_code":"clearsky_day"}}}}]
    Core Function Should Equal    buildDailyForecast    [{"date":"2026-03-05","minC":1,"maxC":2,"symbol":"clearsky_day","code":113,"desc":"clearsky_day"}]    ${ts}    ru
