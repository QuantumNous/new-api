import { sk } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'sk',
    dateFnsLocale: sk,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Položiek na stránke: ${pageSize}',
        total: 'Celkový počet stránok: ${total}',
        jumpTo: 'Preskočiť na',
        page: ' stránku',
    },
    Modal: {
        confirm: 'Potvrdiť',
        cancel: 'Zrušiť',
    },
    Tabs: {
        more: "Viac"
    },
    TimePicker: {
        placeholder: {
            time: 'Vyber čas',
            timeRange: 'Vyber časové obdobie',
        },
        begin: 'Čas začiatku',
        end: 'Čas ukončenia',
        hour: '',
        minute: '',
        second: '',
        AM: 'dop.',
        PM: 'odp.',
    },
    DatePicker: {
        placeholder: {
            date: 'Vyber dátum',
            dateTime: 'Vyber dátum a čas',
            dateRange: ['Dátum začiatku', 'Dátum ukončenia'],
            dateTimeRange: ['Dátum začiatku', 'Dátum ukončenia'],
            monthRange: ['Mesiac začiatku', 'Mesiac ukončenia'],
        },
        presets: 'Predvoľby',
        footer: {
            confirm: 'Potvrdiť',
            cancel: 'Zrušiť',
        },
        selectDate: 'Vyber dátum',
        selectTime: 'Vyber čas',
        year: 'rok',
        month: 'mesiac',
        day: 'deň',
        monthText: '${month} ${year}',
        months: {
            1: 'Jan',
            2: 'Feb',
            3: 'Mar',
            4: 'Apr',
            5: 'Máj',
            6: 'Jún',
            7: 'Júl',
            8: 'Aug',
            9: 'Sep',
            10: 'Okt',
            11: 'Nov',
            12: 'Dec',
        },
        fullMonths: {
            1: 'Január',
            2: 'Február',
            3: 'Marec',
            4: 'Apríl',
            5: 'Máj',
            6: 'Jún',
            7: 'Júl',
            8: 'August',
            9: 'September',
            10: 'Október',
            11: 'November',
            12: 'December',
        },
        weeks: {
            Mon: 'Po',
            Tue: 'Ut',
            Wed: 'St',
            Thu: 'Št',
            Fri: 'Pi',
            Sat: 'So',
            Sun: 'Ne',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd.MM.yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Potvrdiť',
        cancel: 'Zrušiť',
    },
    Navigation: {
        collapseText: 'Zbaliť bočný panel',
        expandText: 'Rozbaliť bočný panel',
    },
    Table: {
        emptyText: 'Žiadny výsledok',
        pageText: 'Zobrazuje sa ${currentStart} až ${currentEnd} z ${total}',
        descend: 'Kliknutím znížiš',
        ascend: 'Kliknutím zvýšiš',
        cancelSort: 'Zrušiť zoradenie',
    },
    Select: {
        emptyText: 'Žiadny výsledok',
        createText: 'Vytvoriť',
    },
    Cascader: {
        emptyText: 'Žiadny výsledok',
    },
    Tree: {
        emptyText: 'Žiadny výsledok',
        searchPlaceholder: 'Hľadať',
    },
    List: {
        emptyText: 'Žiadny výsledok',
    },
    Calendar: {
        allDay: 'Celý deň',
        AM: '${time} dop.',
        PM: '${time} odp.',
        datestring: '',
        remaining: '${remained} ďalších',
    },
    Upload: {
        mainText: 'Kliknutím nahraj súbor alebo ho sem presuň',
        illegalTips: 'Tento typ súboru nie je podporovaný',
        legalTips: 'Pustením začneš nahrávať',
        retry: 'Skúsiť znova',
        replace: 'Nahradiť súbor',
        clear: 'Vymazať',
        selectedFiles: 'Vybrané súbory',
        illegalSize: 'Neplatná veľkosť súboru',
        fail: 'Nahranie zlyhalo',
    },
    TreeSelect: {
        searchPlaceholder: 'Hľadať',
    },
    Typography: {
        copy: 'Skopírovať',
        copied: 'Skopírované',
        expand: 'Rozbaliť',
        collapse: 'Zbaliť',
    },
    Transfer: {
        emptyLeft: 'Žiadne údaje',
        emptySearch: 'Žiadne výsledky hľadania',
        emptyRight: 'Žiadny obsah, zaškrtni vľavo',
        placeholder: 'Hľadať',
        clear: 'Vymazať',
        selectAll: 'Vybrať všetko',
        clearSelectAll: 'Nevybrať nič',
        total: 'Celkový počet položiek: ${total}',
        selected: 'Vybrané položky: ${total}',
    },
    Form: {
        optional: '(voliteľné)',
    },
    Image: {
        preview: 'Ukážka',
        loading: 'Načítava sa',
        loadError: 'Nepodarilo sa načítať',
        prevTip: 'Naspäť',
        nextTip: 'Ďalej',
        zoomInTip: 'Priblížiť',
        zoomOutTip: 'Oddialiť',
        rotateTip: 'Otočiť',
        downloadTip: 'Stiahnuť',
        adaptiveTip: 'Prispôsobiť stránke',
        originTip: 'Pôvodná veľkosť',
    },
    Chat: {
        deleteConfirm: 'Naozaj chceš odstrániť túto reláciu?',
        clearContext: 'Kontext vymazaný',
        copySuccess: 'Kopírovanie bolo úspešné.',
        stop: 'Zastaviť',
        copy: 'Skopírovať',
        copied: 'Skopírované',
        dropAreaText: 'Umiestni súbor sem',
    },
    UserGuide: {
        skip: 'Preskočiť',
        next: 'Ďalej',
        prev: 'Naspäť',
        finish: 'Dokončiť',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Hľadať',
        replace: 'Nahradiť',
        replaceAll: 'Nahradiť všetko',
    },
    VideoPlayer: {
        rateChange: 'Prepnúť rýchlosť na ${rate}',
        qualityChange: 'Prepnúť kvalitu na ${quality}',
        routeChange: 'Prepnúť trasu na ${route}',
        mirror: 'Zrkadliť',
        cancelMirror: 'Zrušiť zrkadlenie',
        loading: 'Načítava sa...',
        stall: 'Nepodarilo sa načítať',
        noResource: 'Žiadny zdroj',
        videoError: 'Chyba načítania videa',
    },
    AIChatDialogue: {
        delete: 'Odstrániť',
        deleteConfirm: 'Naozaj chceš odstrániť túto správu?',
        deleteContent: 'Táto správa bude natrvalo odstránená a nebude sa dať obnoviť.',
        copySuccess: 'Úspešne skopírované',
        loading: 'Načítava sa...',
        reasoning: {
            completed: 'Premýšľanie dokončené',
            thinking: 'Premýšľam...'
        },
        annotationText: 'zdroje informácií'
    },
    Feedback: {
        submit: 'Odoslať',
        cancel: 'Zrušiť'
    },
    AIChatInput: {
        template: 'Šablóna',
        configure: 'Nastaviť',
        selected: 'Vybrané položky (${count})',
    }
};

export default local;