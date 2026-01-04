import { et } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'et',
    dateFnsLocale: et,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Üksusi lehe kohta: ${pageSize}',
        total: 'Lehti kokku: ${total}',
        jumpTo: 'Liigu',
        page: ' lehele',
    },
    Modal: {
        confirm: 'Kinnita',
        cancel: 'Tühista',
    },
    Tabs: {
        more: "Rohkem"
    },
    TimePicker: {
        placeholder: {
            time: 'Vali kellaaeg',
            timeRange: 'Vali ajavahemik',
        },
        begin: 'Algusaeg',
        end: 'Lõppaeg',
        hour: '',
        minute: '',
        second: '',
        AM: 'a.m.',
        PM: 'p.m.',
    },
    DatePicker: {
        placeholder: {
            date: 'Vali kuupäev',
            dateTime: 'Vali kuupäev ja kellaaeg',
            dateRange: ['Alguskuupäev', 'Lõppkuupäev'],
            dateTimeRange: ['Alguskuupäev', 'Lõppkuupäev'],
            monthRange: ['Alguskuu', 'Lõppkuu'],
        },
        presets: 'Eelsätted',
        footer: {
            confirm: 'Kinnita',
            cancel: 'Tühista',
        },
        selectDate: 'Vali kuupäev',
        selectTime: 'Vali kellaaeg',
        year: 'aasta',
        month: 'kuu',
        day: 'päev',
        monthText: '${month} ${year}',
        months: {
            1: 'jaan',
            2: 'veebr',
            3: 'märts',
            4: 'apr',
            5: 'mai',
            6: 'juuni',
            7: 'juuli',
            8: 'aug',
            9: 'sept',
            10: 'okt',
            11: 'nov',
            12: 'dets',
        },
        fullMonths: {
            1: 'jaanuar',
            2: 'veebruar',
            3: 'märts',
            4: 'aprill',
            5: 'mai',
            6: 'juuni',
            7: 'juuli',
            8: 'august',
            9: 'september',
            10: 'oktoober',
            11: 'november',
            12: 'detsember',
        },
        weeks: {
            Mon: 'E',
            Tue: 'T',
            Wed: 'K',
            Thu: 'N',
            Fri: 'R',
            Sat: 'L',
            Sun: 'P',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/MM/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Kinnita',
        cancel: 'Tühista',
    },
    Navigation: {
        collapseText: 'Ahenda külgriba',
        expandText: 'Laienda külgriba',
    },
    Table: {
        emptyText: 'Tulemid puuduvad',
        pageText: 'Kuvatakse ${currentStart} kuni ${currentEnd}, kokku ${total}',
        descend: 'Klõpsa laskumiseks',
        ascend: 'Klõpsake tõusmiseks',
        cancelSort: 'Tühista sorteerimine',
    },
    Select: {
        emptyText: 'Tulemid puuduvad',
        createText: 'Loo',
    },
    Cascader: {
        emptyText: 'Tulemid puuduvad',
    },
    Tree: {
        emptyText: 'Tulemid puuduvad',
        searchPlaceholder: 'Otsi',
    },
    List: {
        emptyText: 'Tulemid puuduvad',
    },
    Calendar: {
        allDay: 'Terve päev',
        AM: '${time} a.m.',
        PM: '${time} p.m.',
        datestring: '',
        remaining: '${remained} veel',
    },
    Upload: {
        mainText: 'Klõpsa faili üleslaadimiseks või lohista see siia',
        illegalTips: 'Seda failitüüpi ei toetata',
        legalTips: 'Vabasta ja alusta üleslaadimist',
        retry: 'Proovi uuesti',
        replace: 'Asenda fail',
        clear: 'Tühjenda',
        selectedFiles: 'Valitud failid',
        illegalSize: 'Faili lubamatu suurus',
        fail: 'Laadi fail üles',
    },
    TreeSelect: {
        searchPlaceholder: 'Otsi',
    },
    Typography: {
        copy: 'Kopeeri',
        copied: 'Kopeeritud',
        expand: 'Laienda',
        collapse: 'Ahenda',
    },
    Transfer: {
        emptyLeft: 'Andmeid pole',
        emptySearch: 'Otsingutulemeid pole',
        emptyRight: 'Sisu puudub, kontrolli vasakult',
        placeholder: 'Otsi',
        clear: 'Tühjenda',
        selectAll: 'Vali kõik',
        clearSelectAll: 'Tühista kogu valik',
        total: 'Üksusi kokku: ${total}',
        selected: 'Valitud üksusi: ${total}',
    },
    Form: {
        optional: '(valikuline)',
    },
    Image: {
        preview: 'Eelvaade',
        loading: 'Käib laadimine.',
        loadError: 'Laadimine nurjus',
        prevTip: 'Eelmine',
        nextTip: 'Järgmine',
        zoomInTip: 'Suumi sisse',
        zoomOutTip: 'Suumi välja',
        rotateTip: 'Pööra',
        downloadTip: 'Laadi alla',
        adaptiveTip: 'Kohanda lehega',
        originTip: 'Algne suurus',
    },
    Chat: {
        deleteConfirm: 'Kas soovid kindlasti selle seansi kustutada?',
        clearContext: 'Kontekst on tühjendatud',
        copySuccess: 'Kopeerimine õnnestus.',
        stop: 'Lõpeta',
        copy: 'Kopeeri',
        copied: 'Kopeeritud',
        dropAreaText: 'Vii fail siia',
    },
    UserGuide: {
        skip: 'Jäta vahele',
        next: 'Järgmine',
        prev: 'Eelmine',
        finish: 'Valmis',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Otsi',
        replace: 'Asenda',
        replaceAll: 'Asenda kõik',
    },
    VideoPlayer: {
        rateChange: 'Määra kiiruseks ${rate}',
        qualityChange: 'Määra kvaliteediks ${quality}',
        routeChange: 'Määra marsruudiks ${route}',
        mirror: 'Peegel',
        cancelMirror: 'Tühista peegel',
        loading: 'Laadimine...',
        stall: 'Laadimine nurjus',
        noResource: 'Ressurss puudub',
        videoError: 'Video laadimise tõrge',
    },
    AIChatDialogue: {
        delete: 'Kustuta',
        deleteConfirm: 'Kas soovid kindlasti selle sõnumi kustutada?',
        deleteContent: 'See sõnum kustutatakse püsivalt ja seda ei saa taastada.',
        copySuccess: 'Kopeerimine õnnestus',
        loading: 'Laadimine on pooleli.',
        reasoning: {
            completed: 'Põhjendus lõpetatud',
            thinking: 'Mõtlemine on pooleli.'
        },
        annotationText: 'infokillud'
    },
    Feedback: {
        submit: 'Esita',
        cancel: 'Loobu'
    },
    AIChatInput: {
        template: 'Mall',
        configure: 'Konfigureeri',
        selected: 'Valitud ${count} elementi',
    }
};

export default local;