import { is } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'is',
    dateFnsLocale: is,
    currency: 'ISK',
    Pagination: {
        pageSize: 'Atriði á síðu: ${pageSize}',
        total: 'Síður alls: ${total}',
        jumpTo: 'Fara á',
        page: ' síðu',
    },
    Modal: {
        confirm: 'Staðfesta',
        cancel: 'Hætta við',
    },
    Tabs: {
        more: "Meira"
    },
    TimePicker: {
        placeholder: {
            time: 'Veldu tíma',
            timeRange: 'Veldu tímabil',
        },
        begin: 'Upphafstími',
        end: 'Lokatími',
        hour: '',
        minute: '',
        second: '',
        AM: 'F. h',
        PM: 'E. h',
    },
    DatePicker: {
        placeholder: {
            date: 'Veldu dagsetningu',
            dateTime: 'Veldu dagsetningu og tíma',
            dateRange: ['Upphafsdagsetning', 'Lokadagsetning'],
            dateTimeRange: ['Upphafsdagsetning', 'Lokadagsetning'],
            monthRange: ['Upphafsmánuður', 'Lokamánuður'],
        },
        presets: 'Forstillingar',
        footer: {
            confirm: 'Staðfesta',
            cancel: 'Hætta við',
        },
        selectDate: 'Veldu dagsetningu',
        selectTime: 'Veldu tíma',
        year: 'ár',
        month: 'mánuður',
        day: 'dagur',
        monthText: '${month} ${year}',
        months: {
            1: 'Jan.',
            2: 'Feb.',
            3: 'Mar.',
            4: 'Apr.',
            5: 'Maí',
            6: 'Jún.',
            7: 'Júl.',
            8: 'Ágú.',
            9: 'Sept.',
            10: 'Okt.',
            11: 'Nóv.',
            12: 'Des.',
        },
        fullMonths: {
            1: 'Janúar',
            2: 'Febrúar',
            3: 'Mars',
            4: 'Apríl',
            5: 'Maí',
            6: 'Júní',
            7: 'Júlí',
            8: 'Ágúst',
            9: 'September',
            10: 'Október',
            11: 'Nóvember',
            12: 'Desember',
        },
        weeks: {
            Mon: 'Mán.',
            Tue: 'Þri.',
            Wed: 'Mið.',
            Thu: 'Fim.',
            Fri: 'Fös.',
            Sat: 'Lau.',
            Sun: 'Sun.',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/mm/áááá',
        },
    },
    Popconfirm: {
        confirm: 'Staðfesta',
        cancel: 'Hætta við',
    },
    Navigation: {
        collapseText: 'Fella saman hliðarstiku',
        expandText: 'Fella út hliðarstiku',
    },
    Table: {
        emptyText: 'Engar niðurstöður',
        pageText: 'Sýnir ${currentStart} til ${currentEnd} af ${total}',
        descend: 'Smelltu til að fara niður',
        ascend: 'Smelltu til að fara upp',
        cancelSort: 'Hætta við röðun',
    },
    Select: {
        emptyText: 'Engar niðurstöður',
        createText: 'Búa til',
    },
    Cascader: {
        emptyText: 'Engar niðurstöður',
    },
    Tree: {
        emptyText: 'Engar niðurstöður',
        searchPlaceholder: 'Leita',
    },
    List: {
        emptyText: 'Engar niðurstöður',
    },
    Calendar: {
        allDay: 'Allan daginn',
        AM: '${time} f.h.',
        PM: '${time} e.h.',
        datestring: '',
        remaining: '${remained} fleiri',
    },
    Upload: {
        mainText: 'Smelltu á hlaða upp skrá eða dragðu skrána hingað',
        illegalTips: 'Þessi skráartegund er ekki studd',
        legalTips: 'Slepptu og byrjaðu að hlaða upp',
        retry: 'Reyna aftur',
        replace: 'Skipta út skrá',
        clear: 'Hreinsa',
        selectedFiles: 'Valdar skrár',
        illegalSize: 'Óleyfileg skráarstærð',
        fail: 'Upphleðsla mistókst',
    },
    TreeSelect: {
        searchPlaceholder: 'Leita',
    },
    Typography: {
        copy: 'Afrita',
        copied: 'Afritað',
        expand: 'Stækka',
        collapse: 'Minnka',
    },
    Transfer: {
        emptyLeft: 'Engin gögn',
        emptySearch: 'Engar leitarniðurstöður',
        emptyRight: 'Ekkert efni, hakaðu við vinstra megin',
        placeholder: 'Leita',
        clear: 'Hreinsa',
        selectAll: 'Velja allt',
        clearSelectAll: 'Afvelja allt',
        total: 'Atriði alls: ${total}',
        selected: 'Atriði valin: ${total}',
    },
    Form: {
        optional: '(valfrjálst)',
    },
    Image: {
        preview: 'Forskoðun',
        loading: 'Hleður',
        loadError: 'Ekki tókst að hlaða',
        prevTip: 'Fyrra',
        nextTip: 'Næsta',
        zoomInTip: 'Súmma inn',
        zoomOutTip: 'Súmma út',
        rotateTip: 'Snúa',
        downloadTip: 'Hlaða niður',
        adaptiveTip: 'Aðlaga að síðunni',
        originTip: 'Upprunaleg stærð',
    },
    Chat: {
        deleteConfirm: 'Ertu viss um að þú viljir eyða þessari lotu?',
        clearContext: 'Samhengi hreinsað',
        copySuccess: 'Afritun tókst.',
        stop: 'Hætta',
        copy: 'Afrita',
        copied: 'Afritað',
        dropAreaText: 'Settu skrána hér',
    },
    UserGuide: {
        skip: 'Sleppa',
        next: 'Næsta',
        prev: 'Fyrra',
        finish: 'Ljúka',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Leita',
        replace: 'Skipta út',
        replaceAll: 'Skipta öllu út',
    },
    VideoPlayer: {
        rateChange: 'Breyta hraða í ${rate}',
        qualityChange: 'Breyta gæðum í ${quality}',
        routeChange: 'Breyta leið í ${route}',
        mirror: 'Spegla',
        cancelMirror: 'Hætta við speglun',
        loading: 'Hleður...',
        stall: 'Ekki tókst að hlaða',
        noResource: 'Engin úrræði',
        videoError: 'Villa við að hlaða vídeó',
    },
    AIChatDialogue: {
        delete: 'Eyða',
        deleteConfirm: 'Ertu viss um að þú viljir eyða skilaboðunum?',
        deleteContent: 'Skilaboðunum verður varanlega eytt og ekki verður hægt að endurheimta þau',
        copySuccess: 'Afritun tókst',
        loading: 'Hleður...',
        reasoning: {
            completed: 'Rökleiðslu lokið',
            thinking: 'Hugsar...'
        },
        annotationText: 'upplýsingamolar'
    },
    Feedback: {
        submit: 'Senda',
        cancel: 'Hætta við'
    },
    AIChatInput: {
        template: 'Sniðmát',
        configure: 'Stilla',
        selected: '${count} atriði valin',
    }
};

export default local;