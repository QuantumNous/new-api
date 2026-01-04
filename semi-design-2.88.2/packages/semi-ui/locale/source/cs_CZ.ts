import { cs } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'cs-CZ',
    dateFnsLocale: cs,
    currency: 'Kč',
    Pagination: {
        pageSize: 'Položek na stránce: ${pageSize}',
        total: 'Celkem stránek: ${total}',
        jumpTo: 'Přeskočit na',
        page: ' stranu',
    },
    Modal: {
        confirm: 'Potvrdit',
        cancel: 'Zrušit',
    },
    Tabs: {
        more: "Více"
    },
    TimePicker: {
        placeholder: {
            time: 'Vyber čas',
            timeRange: 'Vyber časové období',
        },
        begin: 'Čas začátku',
        end: 'Čas konce',
        hour: '',
        minute: '',
        second: '',
        AM: 'Dop.',
        PM: 'Odp.',
    },
    DatePicker: {
        placeholder: {
            date: 'Vyber datum',
            dateTime: 'Vyber datum a čas',
            dateRange: ['Datum začátku', 'Datum konce'],
            dateTimeRange: ['Datum začátku', 'Datum konce'],
            monthRange: ['Měsíc začátku', 'Měsíc konce'],
        },
        presets: 'Předvolby',
        footer: {
            confirm: 'Potvrdit',
            cancel: 'Zrušit',
        },
        selectDate: 'Vyber datum',
        selectTime: 'Vyber čas',
        year: 'rok',
        month: 'měsíc',
        day: 'den',
        monthText: '${month} ${year}',
        months: {
            1: 'Led',
            2: 'Úno',
            3: 'Bře',
            4: 'Dub',
            5: 'Kvě',
            6: 'Čvn',
            7: 'Čvc',
            8: 'Srp',
            9: 'Zář',
            10: 'Říj',
            11: 'Lis',
            12: 'Pro',
        },
        fullMonths: {
            1: 'Leden',
            2: 'Únor',
            3: 'Březen',
            4: 'Duben',
            5: 'Květen',
            6: 'Červen',
            7: 'Červenec',
            8: 'Srpen',
            9: 'Září',
            10: 'Říjen',
            11: 'Listopad',
            12: 'Prosinec',
        },
        weeks: {
            Mon: 'Po',
            Tue: 'Út',
            Wed: 'St',
            Thu: 'Čt',
            Fri: 'Pá',
            Sat: 'So',
            Sun: 'Ne',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd.MM.yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Potvrdit',
        cancel: 'Zrušit',
    },
    Navigation: {
        collapseText: 'Sbalit boční panel',
        expandText: 'Rozbalit boční panel',
    },
    Table: {
        emptyText: 'Žádný výsledek',
        pageText: 'Zobrazeno ${currentStart} až ${currentEnd} z ${total}',
        descend: 'Kliknutím sniž',
        ascend: 'Kliknutím zvyš',
        cancelSort: 'Zrušit řazení',
    },
    Select: {
        emptyText: 'Žádný výsledek',
        createText: 'Vytvořit',
    },
    Cascader: {
        emptyText: 'Žádný výsledek',
    },
    Tree: {
        emptyText: 'Žádný výsledek',
        searchPlaceholder: 'Hledat',
    },
    List: {
        emptyText: 'Žádný výsledek',
    },
    Calendar: {
        allDay: 'Celý den',
        AM: '${time} dop.',
        PM: '${time} odp.',
        datestring: '',
        remaining: '${remained} dalších',
    },
    Upload: {
        mainText: 'Kliknutím nahraj soubor nebo ho sem přetáhni',
        illegalTips: 'Tento typ souboru není podporovaný',
        legalTips: 'Uvolnit a začít nahrávat',
        retry: 'Zkusit znova',
        replace: 'Nahradit soubor',
        clear: 'Vymazat',
        selectedFiles: 'Vybrané soubory',
        illegalSize: 'Neplatná velikost souboru',
        fail: 'Nahrání se nezdařilo',
    },
    TreeSelect: {
        searchPlaceholder: 'Hledat',
    },
    Typography: {
        copy: 'Kopírovat',
        copied: 'Zkopírováno',
        expand: 'Rozbalit',
        collapse: 'Sbalit',
    },
    Transfer: {
        emptyLeft: 'Žádné údaje',
        emptySearch: 'Žádné výsledky vyhledávání',
        emptyRight: 'Žádný obsah, zaškrtni vlevo',
        placeholder: 'Hledat',
        clear: 'Vymazat',
        selectAll: 'Vybrat vše',
        clearSelectAll: 'Zrušit výběr všeho',
        total: 'Celkem položek: ${total}',
        selected: 'Vybrané položky: ${total}',
    },
    Form: {
        optional: '(volitelné)',
    },
    Image: {
        preview: 'Náhled',
        loading: 'Načítání',
        loadError: 'Načtení se nezdařilo',
        prevTip: 'Předchozí',
        nextTip: 'Další',
        zoomInTip: 'Přiblížit',
        zoomOutTip: 'Oddálit',
        rotateTip: 'Otočit',
        downloadTip: 'Stáhnout',
        adaptiveTip: 'Přizpůsobit stránce',
        originTip: 'Původní velikost',
    },
    Chat: {
        deleteConfirm: 'Opravdu chceš odstranit tuhle relaci?',
        clearContext: 'Kontext vymazán',
        copySuccess: 'Kopírování bylo úspěšné.',
        stop: 'Zastavit',
        copy: 'Kopírovat',
        copied: 'Zkopírováno',
        dropAreaText: 'Umísti soubor sem',
    },
    UserGuide: {
        skip: 'Přeskočit',
        next: 'Další',
        prev: 'Předchozí',
        finish: 'Dokončit',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Hledat',
        replace: 'Nahradit',
        replaceAll: 'Nahradit vše',
    },
    VideoPlayer: {
        rateChange: 'Přepnout rychlost na ${rate}',
        qualityChange: 'Přepnout kvalitu na ${quality}',
        routeChange: 'Přepnout trasu na ${route}',
        mirror: 'Zrcadlit',
        cancelMirror: 'Zrušit zrcadlení',
        loading: 'Načítání…',
        stall: 'Načítání selhalo',
        noResource: 'Žádný zdroj',
        videoError: 'Chyba načítání videa',
    },
    AIChatDialogue: {
        delete: 'Odstranit',
        deleteConfirm: 'Opravdu chceš tuto zprávu odstranit?',
        deleteContent: 'Tato zpráva bude trvale odstraněna a nebudeš ji moct obnovit.',
        copySuccess: 'Kopírování bylo úspěšné',
        loading: 'Načítání…',
        reasoning: {
            completed: 'Přemýšlení dokončeno',
            thinking: 'Přemýšlím…'
        },
        annotationText: 'zdroje informací'
    },
    Feedback: {
        submit: 'Odeslat',
        cancel: 'Zrušit'
    },
    AIChatInput: {
        template: 'Šablona',
        configure: 'Nastavení',
        selected: 'Vybrané položky (${count})',
    }
};

export default local;