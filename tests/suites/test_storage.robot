*** Settings ***
Documentation    Юнит-тесты lib/storage.js: буквы столбцов, листы, i18n,
...              миграции, слияние с дефолтами, экспорт констант.
Library          ../lib/TabulaCoreLibrary.py
Library          Collections

*** Test Cases ***
Col Letter Basics
    [Documentation]    colLetter: 0 -> A, 25 -> Z, 26 -> AA, 701 -> ZZ, 702 -> AAA
    Storage Function Should Equal    colLetter    A    0
    Storage Function Should Equal    colLetter    Z    25
    Storage Function Should Equal    colLetter    AA    26
    Storage Function Should Equal    colLetter    AZ    51
    Storage Function Should Equal    colLetter    BA    52
    Storage Function Should Equal    colLetter    ZZ    701
    Storage Function Should Equal    colLetter    AAA    702

Clamp Cols Bounds
    [Documentation]    clampCols: нижняя/верхняя границы и валидные значения
    Storage Function Should Equal    clampCols    3    2
    Storage Function Should Equal    clampCols    12    20
    Storage Function Should Equal    clampCols    5    5

Clamp Cols Invalid Input
    Storage Function Should Equal    clampCols    8    abc
    Storage Function Should Equal    clampCols    8    ${None}

Compute Rows For Sheet
    [Documentation]    max(minRows, maxRow + 4), по умолчанию 12 строк
    Storage Function Should Equal    computeRowsForSheet    12    {"cells":{},"columns":8}
    Storage Function Should Equal    computeRowsForSheet    24    {"cells":{"20,3":{}},"columns":8}
    Storage Function Should Equal    computeRowsForSheet    12    {"name":"x"}

Find First Empty Cell
    Storage Function Should Equal    findFirstEmptyCell    0,0    {"cells":{},"columns":8}
    Storage Function Should Equal    findFirstEmptyCell    0,2    {"cells":{"0,0":{},"0,1":{}},"columns":8}
    Storage Function Should Equal    findFirstEmptyCell    1,0    {"cells":{"0,0":{},"0,1":{},"0,2":{},"0,3":{},"0,4":{},"0,5":{},"0,6":{},"0,7":{}},"columns":8}
    Storage Function Should Equal    findFirstEmptyCell    ${None}    {"cells":{"0,0":{}},"columns":1}    1    1
    Storage Function Should Equal    findFirstEmptyCell    0,1    {"cells":{"0,0":{}},"columns":8}    2    8

Get Active Sheet
    Storage Function Should Equal    getActiveSheet    {"id":"s2","name":"Two"}    {"sheets":[{"id":"s1","name":"One"},{"id":"s2","name":"Two"}],"activeSheetId":"s2"}
    Storage Function Should Equal    getActiveSheet    {"id":"s1","name":"One"}    {"sheets":[{"id":"s1","name":"One"},{"id":"s2","name":"Two"}]}
    Storage Function Should Equal    getActiveSheet    ${None}    {}
    Storage Function Should Equal    getActiveSheet    ${None}    ${None}

Make Blank Sheet
    ${s} =    Call Storage Function    makeBlankSheet    Тест    5
    Should Be Equal    ${s}[name]    Тест
    Should Be Equal    ${s}[icon]    📋
    Should Be Empty    ${s}[cells]
    Should Start With    ${s}[id]    id_
    Should Be Equal As Numbers    ${s}[columns]    5

    ${s} =    Call Storage Function    makeBlankSheet    ${None}    2
    Should Be Equal    ${s}[name]    Лист
    Should Be Equal As Numbers    ${s}[columns]    3

Crypto Id Is Unique
    ${a} =    Call Storage Function    cryptoId
    ${b} =    Call Storage Function    cryptoId
    Should Start With    ${a}    id_
    Should Start With    ${b}    id_
    Should Not Be Equal    ${a}    ${b}

Resolve Font
    Storage Function Should Equal    resolveFont    system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif    system    ${EMPTY}
    Storage Function Should Equal    resolveFont    ui-monospace, SFMono-Regular, Menlo, Consolas, monospace    mono    ${EMPTY}
    Storage Function Should Equal    resolveFont    Arial    custom    Arial
    Storage Function Should Equal    resolveFont    system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif    custom    ${EMPTY}
    Storage Function Should Equal    resolveFont    Verdana    nope    Verdana

Translation Lookup
    Storage Function Should Equal    t    Сегодня    weatherToday    ru
    Storage Function Should Equal    t    Today    weatherToday    en
    Storage Function Should Equal    t    Завтра    weatherTomorrow    ru
    Storage Function Should Equal    t    Сегодня    weatherToday    de
    Storage Function Should Equal    t    noSuchKey    noSuchKey    ru

I18N Dictionary
    ${i18n} =    Call Storage Function    I18N
    Should Contain    ${i18n}    ru
    Should Contain    ${i18n}    en
    Should Be Equal    ${i18n}[ru][weatherToday]    Сегодня
    Should Be Equal    ${i18n}[en][weatherToday]    Today

Font Families Presets
    ${ff} =    Call Storage Function    FONT_FAMILIES
    ${len} =    Get Length    ${ff}
    Should Be Equal As Numbers    ${len}    13
    Should Be Equal    ${ff}[0][key]    system
    Should Be Equal    ${ff}[12][key]    custom
    Should Not Be Empty    ${ff}[0][css]

Default Data Structure
    ${d} =    Call Storage Function    defaultData
    ${len} =    Get Length    ${d}[sheets]
    Should Be Equal As Numbers    ${len}    3
    Should Be Equal    ${d}[sheets][0][name]    Главная
    Should Be Equal    ${d}[sheets][1][name]    Работа
    Should Be Equal    ${d}[sheets][2][name]    Новости
    Should Be Equal As Numbers    ${d}[sheets][0][columns]    8
    ${cell00} =    Get From Dictionary    ${d}[sheets][0][cells]    0,0
    Should Be Equal    ${cell00}[title]    Google
    Should Be Equal    ${cell00}[url]    https://google.com
    Should Be Equal    ${d}[settings][cellTextAlign]    left
    Should Be Equal    ${d}[settings][faviconPosition]    left
    Should Be Equal As Numbers    ${d}[settings][defaultColumns]    8
    Should Be Equal    ${d}[settings][language]    ru

DEFAULT_DATA Constant Has Active Sheet
    ${dd} =    Call Storage Function    DEFAULT_DATA
    Should Not Be Empty    ${dd}[activeSheetId]
    ${len} =    Get Length    ${dd}[sheets]
    Should Be Equal As Numbers    ${len}    3

Migrate Null Gives Defaults
    ${d} =    Call Storage Function    migrate    ${None}
    Should Be Equal    ${d}[sheets][0][name]    Главная
    Should Be Equal As Numbers    ${d}[sheets][0][columns]    8
    ${cell00} =    Get From Dictionary    ${d}[sheets][0][cells]    0,0
    Should Be Equal    ${cell00}[title]    Google

Migrate Old Tabs Format
    [Documentation]    Старый формат {tabs, groups} превращается в листы с ячейками
    ${d} =    Call Storage Function    migrate    {"tabs":[{"title":"A","url":"https://a.com","group":"Главная"},{"title":"B","url":"https://b.com"}],"groups":["Главная","Работа"]}
    Should Be Equal    ${d}[sheets][0][name]    Главная
    Should Be Equal    ${d}[sheets][1][name]    Работа
    ${cell00} =    Get From Dictionary    ${d}[sheets][0][cells]    0,0
    ${cell01} =    Get From Dictionary    ${d}[sheets][0][cells]    0,1
    Should Be Equal    ${cell00}[title]    A
    Should Be Equal    ${cell01}[title]    B
    Should Be Equal    ${d}[activeSheetId]    ${d}[sheets][0][id]

Migrate Modern Sheets Cleans Legacy Settings
    ${d} =    Call Storage Function    migrate    {"sheets":[{"id":"x","name":"Мой","columns":5,"tabs":[{"title":"T","url":"U"}]}],"activeSheetId":"x","settings":{"cellBg":"#fff","defaultColumns":20}}
    Should Be Equal    ${d}[sheets][0][name]    Мой
    Should Be Equal As Numbers    ${d}[sheets][0][columns]    5
    ${cell00} =    Get From Dictionary    ${d}[sheets][0][cells]    0,0
    Should Be Equal    ${cell00}[title]    T
    Should Be Equal    ${d}[activeSheetId]    x
    Should Not Contain    ${d}[settings]    cellBg
    Should Be Equal As Numbers    ${d}[settings][defaultColumns]    20

Merge With Defaults Null
    ${d} =    Call Storage Function    mergeWithDefaults    ${None}
    Should Be Equal As Numbers    ${d}[settings][defaultColumns]    8
    ${len} =    Get Length    ${d}[sheets]
    Should Be Equal As Numbers    ${len}    3

Merge With Defaults Merges And Clamps
    ${d} =    Call Storage Function    mergeWithDefaults    {"settings":{"cellTextAlign":"right","cellBg":"#fff","defaultColumns":20},"sheets":[{"name":"S","cells":{}}]}
    Should Be Equal    ${d}[settings][cellTextAlign]    right
    Should Be Equal As Numbers    ${d}[settings][defaultColumns]    12
    Should Not Contain    ${d}[settings]    cellBg
    Should Be Equal    ${d}[sheets][0][name]    S
    Should Be Equal As Numbers    ${d}[sheets][0][columns]    8
    Should Not Be Empty    ${d}[activeSheetId]
