import { da } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'da',
    dateFnsLocale: da,
    currency: 'DKK',
    Pagination: {
        pageSize: 'Varer pr. side ${pageSize}',
        total: 'Samlet antal sider: ${total}',
        jumpTo: 'Hop til',
        page: ' side',
    },
    Modal: {
        confirm: 'Bekræft',
        cancel: 'Annullér',
    },
    Tabs: {
        more: "Mere"
    },
    TimePicker: {
        placeholder: {
            time: 'Vælg tidspunkt',
            timeRange: 'Vælg et tidsinterval',
        },
        begin: 'Starttidspunkt',
        end: 'Sluttidspunkt',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'Vælg dato',
            dateTime: 'Vælg dato og tidspunkt',
            dateRange: ['Startdato', 'Slutdato'],
            dateTimeRange: ['Startdato', 'Slutdato'],
            monthRange: ['Startmåned', 'Slutmåned'],
        },
        presets: 'Forudindstillinger',
        footer: {
            confirm: 'Bekræft',
            cancel: 'Annullér',
        },
        selectDate: 'Vælg dato',
        selectTime: 'Vælg tidspunkt',
        year: 'år',
        month: 'måned',
        day: 'dag',
        monthText: '${month} ${year}',
        months: {
            1: 'Jan.',
            2: 'Feb.',
            3: 'Mar.',
            4: 'Apr.',
            5: 'Maj',
            6: 'Juni',
            7: 'Juli',
            8: 'Aug.',
            9: 'Sept.',
            10: 'Okt.',
            11: 'Nov.',
            12: 'Dec.',
        },
        fullMonths: {
            1: 'Januar',
            2: 'Februar',
            3: 'Marts',
            4: 'April',
            5: 'Maj',
            6: 'Juni',
            7: 'Juli',
            8: 'August',
            9: 'September',
            10: 'Oktober',
            11: 'November',
            12: 'December',
        },
        weeks: {
            Mon: 'Man.',
            Tue: 'Tirs.',
            Wed: 'Ons.',
            Thu: 'Tors.',
            Fri: 'Fre.',
            Sat: 'Lør.',
            Sun: 'Søn.',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'MM/dd/ååå',
        },
    },
    Popconfirm: {
        confirm: 'Bekræft',
        cancel: 'Annullér',
    },
    Navigation: {
        collapseText: 'Minimer sidepanel',
        expandText: 'Udvid sidepanel',
    },
    Table: {
        emptyText: 'Intet resultat',
        pageText: 'Viser ${currentStart} til ${currentEnd} af ${total}',
        descend: 'Klik for faldende',
        ascend: 'Klik for stigende',
        cancelSort: 'Annuller sortering',
    },
    Select: {
        emptyText: 'Intet resultat',
        createText: 'Opret',
    },
    Cascader: {
        emptyText: 'Intet resultat',
    },
    Tree: {
        emptyText: 'Intet resultat',
        searchPlaceholder: 'Søg',
    },
    List: {
        emptyText: 'Intet resultat',
    },
    Calendar: {
        allDay: 'Hele dagen',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} mere',
    },
    Upload: {
        mainText: 'Klik for at uploade fil, eller træk fil hertil',
        illegalTips: 'Denne filtype understøttes ikke',
        legalTips: 'Slip, og begynd at uploade',
        retry: 'Prøv igen',
        replace: 'Erstat fil',
        clear: 'Ryd',
        selectedFiles: 'Valgte filer',
        illegalSize: 'Ulovlig filstørrelse',
        fail: 'Upload mislykkedes',
    },
    TreeSelect: {
        searchPlaceholder: 'Søg',
    },
    Typography: {
        copy: 'Kopiér',
        copied: 'Kopieret',
        expand: 'Udvid',
        collapse: 'Minimer',
    },
    Transfer: {
        emptyLeft: 'Ingen data',
        emptySearch: 'Ingen søgeresultater',
        emptyRight: 'Intet indhold, tjek fra venstre',
        placeholder: 'Søg',
        clear: 'Ryd',
        selectAll: 'Vælg alle',
        clearSelectAll: 'Fravælg alle',
        total: 'Samlet antal varer: ${total}',
        selected: 'Valgte varer: ${total}',
    },
    Form: {
        optional: '(valgfri)',
    },
    Image: {
        preview: 'Forhåndsvis',
        loading: 'Indlæser',
        loadError: 'Kunne ikke indlæse',
        prevTip: 'Tidligere',
        nextTip: 'Næste',
        zoomInTip: 'Zoom ind',
        zoomOutTip: 'Zoom ud',
        rotateTip: 'Roter',
        downloadTip: 'Download',
        adaptiveTip: 'Tilpas til siden',
        originTip: 'Original størrelse',
    },
    Chat: {
        deleteConfirm: 'Er du sikker på at du vil slette denne session?',
        clearContext: 'Kontekst ryddet',
        copySuccess: 'Kopiering lykkedes.',
        stop: 'Stop',
        copy: 'Kopiér',
        copied: 'Kopieret',
        dropAreaText: 'Put filen her',
    },
    UserGuide: {
        skip: 'Spring over',
        next: 'Næste',
        prev: 'Tidligere',
        finish: 'Afslut',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Søg',
        replace: 'Erstat',
        replaceAll: 'Erstat alle',
    },
    VideoPlayer: {
        rateChange: 'Skift hastighed til ${rate}',
        qualityChange: 'Skift kvalitet til ${quality}',
        routeChange: 'Skift rute til ${route}',
        mirror: 'Spejl',
        cancelMirror: 'Annuller spejling',
        loading: 'Indlæser ...',
        stall: 'Indlæsning mislykkedes',
        noResource: 'Ingen ressource',
        videoError: 'Videoindlæsningsfejl',
    },
    AIChatDialogue: {
        delete: 'Slet',
        deleteConfirm: 'Er du sikker på, at du vil slette denne besked?',
        deleteContent: 'Denne besked bliver slettet permanent og kan ikke gendannes.',
        copySuccess: 'Kopiering lykkedes',
        loading: 'Indlæser ...',
        reasoning: {
            completed: 'Ræsonnering gennemført',
            thinking: 'Tænker ...'
        },
        annotationText: 'kilder'
    },
    Feedback: {
        submit: 'Indsend',
        cancel: 'Annuller'
    },
    AIChatInput: {
        template: 'Skabelon',
        configure: 'Konfigurer',
        selected: 'Valgte ${count} elementer',
    }
};

export default local;