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
Documentation    Юнит-тесты diffTabulaData (src/lib/core.js): точечные диффы
...              для onChanged — определяют, какие части данных реально
...              изменились, чтобы фоновые обновления (погода, Bing) не
...              перерисовывали всю сетку.
Library          ../lib/TabulaCoreLibrary.py
Library          Collections

*** Variables ***
${PREV}    {"sheets":[{"id":"s1","name":"One"},{"id":"s2","name":"Two"}],"activeSheetId":"s1","settings":{"language":"ru","showWeather":true,"uiScale":100},"weatherCaches":{"city1":{"t":1}},"bingCache":{"date":"2026-08-12"}}
${SAME}    {"sheets":[{"id":"s1","name":"One"},{"id":"s2","name":"Two"}],"activeSheetId":"s1","settings":{"language":"ru","showWeather":true,"uiScale":100},"weatherCaches":{"city1":{"t":1}},"bingCache":{"date":"2026-08-12"}}

*** Test Cases ***
Diff No Changes / Без изменений — все флаги false
    [Documentation]    Идентичные prev и next: ничего не изменилось.
    ${res} =    Call Core Function    diffTabulaData    ${PREV}    ${SAME}    ru
    Should Be Equal    ${res}[sheetsChanged]    ${False}
    Should Be Equal    ${res}[activeChanged]    ${False}
    Should Be Equal    ${res}[settingsChanged]    ${False}
    Should Be Equal    ${res}[weatherChanged]    ${False}
    Should Be Equal    ${res}[bingChanged]    ${False}
    Should Be Equal    ${res}[langChanged]    ${False}
    Should Be Equal    ${res}[nextSettings][language]    ru
    Should Be Equal    ${res}[prevSettings][language]    ru

Diff Sheets Changed / Изменился состав листов
    [Documentation]    Переименован лист: sheetsChanged true, остальное false.
    ${next} =    Set Variable    {"sheets":[{"id":"s1","name":"One"},{"id":"s2","name":"Two Edited"}],"activeSheetId":"s1","settings":{"language":"ru"},"weatherCaches":{"city1":{"t":1}},"bingCache":{"date":"2026-08-12"}}
    ${res} =    Call Core Function    diffTabulaData    ${PREV}    ${next}    ru
    Should Be Equal    ${res}[sheetsChanged]    ${True}
    Should Be Equal    ${res}[activeChanged]    ${False}
    Should Be Equal    ${res}[settingsChanged]    ${False}
    Should Be Equal    ${res}[weatherChanged]    ${False}
    Should Be Equal    ${res}[bingChanged]    ${False}

Diff Active Sheet Changed / Сменился активный лист
    [Documentation]    Только activeSheetId: activeChanged true, сетка не «диффится» по sheets.
    ${next} =    Set Variable    {"sheets":[{"id":"s1","name":"One"},{"id":"s2","name":"Two"}],"activeSheetId":"s2","settings":{"language":"ru"},"weatherCaches":{"city1":{"t":1}},"bingCache":{"date":"2026-08-12"}}
    ${res} =    Call Core Function    diffTabulaData    ${PREV}    ${next}    ru
    Should Be Equal    ${res}[sheetsChanged]    ${False}
    Should Be Equal    ${res}[activeChanged]    ${True}
    Should Be Equal    ${res}[settingsChanged]    ${False}

Diff Settings And Language Changed / Изменились настройки и язык
    [Documentation]    settings мержатся с prev: недостающие поля сохраняются,
    ...                language en при текущем ru → langChanged true.
    ${next} =    Set Variable    {"sheets":[{"id":"s1","name":"One"},{"id":"s2","name":"Two"}],"activeSheetId":"s1","settings":{"language":"en","showWeather":false},"weatherCaches":{"city1":{"t":1}},"bingCache":{"date":"2026-08-12"}}
    ${res} =    Call Core Function    diffTabulaData    ${PREV}    ${next}    ru
    Should Be Equal    ${res}[settingsChanged]    ${True}
    Should Be Equal    ${res}[langChanged]    ${True}
    Should Be Equal    ${res}[nextSettings][language]    en
    Should Be Equal As Numbers    ${res}[nextSettings][uiScale]    100
    Should Be Equal    ${res}[nextSettings][showWeather]    ${False}
    Should Be Equal    ${res}[sheetsChanged]    ${False}

Diff Lang Not Changed / Тот же язык — langChanged false
    ${next} =    Set Variable    {"sheets":[{"id":"s1","name":"One"},{"id":"s2","name":"Two"}],"activeSheetId":"s1","settings":{"language":"ru","uiScale":80},"weatherCaches":{"city1":{"t":1}},"bingCache":{"date":"2026-08-12"}}
    ${res} =    Call Core Function    diffTabulaData    ${PREV}    ${next}    ru
    Should Be Equal    ${res}[settingsChanged]    ${True}
    Should Be Equal    ${res}[langChanged]    ${False}
    Should Be Equal As Numbers    ${res}[nextSettings][uiScale]    80

Diff Weather Cache Changed / Обновился кэш погоды
    [Documentation]    Фоновое обновление weatherCaches: только weatherChanged.
    ${next} =    Set Variable    {"sheets":[{"id":"s1","name":"One"},{"id":"s2","name":"Two"}],"activeSheetId":"s1","settings":{"language":"ru"},"weatherCaches":{"city1":{"t":2}},"bingCache":{"date":"2026-08-12"}}
    ${res} =    Call Core Function    diffTabulaData    ${PREV}    ${next}    ru
    Should Be Equal    ${res}[weatherChanged]    ${True}
    Should Be Equal    ${res}[sheetsChanged]    ${False}
    Should Be Equal    ${res}[settingsChanged]    ${False}
    Should Be Equal    ${res}[bingChanged]    ${False}

Diff Bing Cache Changed / Обновился кэш Bing
    [Documentation]    Фоновое обновление bingCache: только bingChanged.
    ${next} =    Set Variable    {"sheets":[{"id":"s1","name":"One"},{"id":"s2","name":"Two"}],"activeSheetId":"s1","settings":{"language":"ru"},"weatherCaches":{"city1":{"t":1}},"bingCache":{"date":"2026-08-13"}}
    ${res} =    Call Core Function    diffTabulaData    ${PREV}    ${next}    ru
    Should Be Equal    ${res}[bingChanged]    ${True}
    Should Be Equal    ${res}[weatherChanged]    ${False}
    Should Be Equal    ${res}[activeChanged]    ${False}
    Should Be Equal    ${res}[sheetsChanged]    ${False}

Diff Partial Next / Частичное next: только activeSheetId
    [Documentation]    next без sheets/settings/кэшей не должен давать ложных диффов.
    ${res} =    Call Core Function    diffTabulaData    ${PREV}    {"activeSheetId":"s2"}    ru
    Should Be Equal    ${res}[activeChanged]    ${True}
    Should Be Equal    ${res}[sheetsChanged]    ${False}
    Should Be Equal    ${res}[settingsChanged]    ${False}
    Should Be Equal    ${res}[weatherChanged]    ${False}
    Should Be Equal    ${res}[bingChanged]    ${False}

Diff Next Without Caches / next без кэшей
    [Documentation]    Отсутствующие в next кэши считаются неизменными (не undefined-ложь).
    ${next} =    Set Variable    {"sheets":[{"id":"s1","name":"One"},{"id":"s2","name":"Two"}],"activeSheetId":"s1","settings":{"language":"ru"}}
    ${res} =    Call Core Function    diffTabulaData    ${PREV}    ${next}    ru
    Should Be Equal    ${res}[weatherChanged]    ${False}
    Should Be Equal    ${res}[bingChanged]    ${False}
    Should Be Equal    ${res}[sheetsChanged]    ${False}
    Should Be Equal    ${res}[activeChanged]    ${False}

Diff Prev Null / prev отсутствует (первый onChanged)
    [Documentation]    prev = null: всё, что есть в next, считается изменённым,
    ...                но язык — из next (ru === ru → langChanged false).
    ${res} =    Call Core Function    diffTabulaData    ${None}    ${SAME}    ru
    Should Be Equal    ${res}[sheetsChanged]    ${True}
    Should Be Equal    ${res}[activeChanged]    ${True}
    Should Be Equal    ${res}[settingsChanged]    ${True}
    Should Be Equal    ${res}[weatherChanged]    ${True}
    Should Be Equal    ${res}[bingChanged]    ${True}
    Should Be Equal    ${res}[langChanged]    ${False}
    Should Be Equal    ${res}[nextSettings][language]    ru

Diff Prev Null Lang Mismatch / prev null и другой язык в next
    ${res} =    Call Core Function    diffTabulaData    ${None}    ${SAME}    en
    Should Be Equal    ${res}[langChanged]    ${True}

Diff Next Null / next отсутствует — отменяет обработку
    [Documentation]    onChanged с пустым next игнорируется (main.js: if (!next) return).
    ${res} =    Call Core Function    diffTabulaData    ${PREV}    ${None}    ru
    Should Be Equal    ${res}[sheetsChanged]    ${False}
    Should Be Equal    ${res}[activeChanged]    ${False}
    Should Be Equal    ${res}[settingsChanged]    ${False}
    Should Be Equal    ${res}[weatherChanged]    ${False}
    Should Be Equal    ${res}[bingChanged]    ${False}
