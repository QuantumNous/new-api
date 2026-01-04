import { nb } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'nb',
    dateFnsLocale: nb,
    currency: 'NOK',
    Pagination: {
        pageSize: 'Elementer per side: ${pageSize}',
        total: 'Totalt antall sider: ${total}',
        jumpTo: 'Hopp til',
        page: ' side',
    },
    Modal: {
        confirm: 'Bekreft',
        cancel: 'Avbryt',
    },
    Tabs: {
        more: "Mer"
    },
    TimePicker: {
        placeholder: {
            time: 'Velg tidspunkt',
            timeRange: 'Velg et tidsintervall',
        },
        begin: 'Starttid',
        end: 'Sluttid',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'Velg dato',
            dateTime: 'Velg dato og klokkeslett',
            dateRange: ['Startdato', 'Sluttdato'],
            dateTimeRange: ['Startdato', 'Sluttdato'],
            monthRange: ['Startmåned', 'Sluttmåned'],
        },
        presets: 'Forhåndsinnstillinger',
        footer: {
            confirm: 'Bekreft',
            cancel: 'Avbryt',
        },
        selectDate: 'Velg dato',
        selectTime: 'Velg tidspunkt',
        year: 'år',
        month: 'måned',
        day: 'dag',
        monthText: '${month} ${year}',
        months: {
            1: 'jan.',
            2: 'feb.',
            3: 'mars',
            4: 'april',
            5: 'mai',
            6: 'juni',
            7: 'juli',
            8: 'aug.',
            9: 'sep.',
            10: 'okt.',
            11: 'nov.',
            12: 'des.',
        },
        fullMonths: {
            1: 'januar',
            2: 'februar',
            3: 'mars',
            4: 'april',
            5: 'mai',
            6: 'juni',
            7: 'juli',
            8: 'august',
            9: 'september',
            10: 'oktober',
            11: 'november',
            12: 'desember',
        },
        weeks: {
            Mon: 'ma.',
            Tue: 'ti.',
            Wed: 'on.',
            Thu: 'to.',
            Fri: 'fr.',
            Sat: 'lø.',
            Sun: 'sø.',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd.MM.yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Bekreft',
        cancel: 'Avbryt',
    },
    Navigation: {
        collapseText: 'Skjul sidepanel',
        expandText: 'Vis sidepanel',
    },
    Table: {
        emptyText: 'Ingen resultater',
        pageText: 'Viser ${currentStart} til ${currentEnd} av ${total}',
        descend: 'Klikk for synkende',
        ascend: 'Klikk for stigende',
        cancelSort: 'Avbryt sortering',
    },
    Select: {
        emptyText: 'Ingen resultater',
        createText: 'Skap',
    },
    Cascader: {
        emptyText: 'Ingen resultater',
    },
    Tree: {
        emptyText: 'Ingen resultater',
        searchPlaceholder: 'Søk',
    },
    List: {
        emptyText: 'Ingen resultater',
    },
    Calendar: {
        allDay: 'Hele dagen',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} flere',
    },
    Upload: {
        mainText: 'Klikk for å laste opp en fil eller dra en fil hit',
        illegalTips: 'Denne filtypen støttes ikke',
        legalTips: 'Slipp og begynn opplastingen',
        retry: 'Prøv på nytt',
        replace: 'Erstatt filen',
        clear: 'Tøm',
        selectedFiles: 'Valgte filer',
        illegalSize: 'Ulovlig filstørrelse',
        fail: 'Opplastingen mislyktes',
    },
    TreeSelect: {
        searchPlaceholder: 'Søk',
    },
    Typography: {
        copy: 'Kopier',
        copied: 'Kopiert',
        expand: 'Vis',
        collapse: 'Skjul',
    },
    Transfer: {
        emptyLeft: 'Ingen data',
        emptySearch: 'Ingen søkeresultater',
        emptyRight: 'Ikke noe innhold. Huk av til venstre.',
        placeholder: 'Søk',
        clear: 'Tøm',
        selectAll: 'Velg alt',
        clearSelectAll: 'Fjern merkingen av alt',
        total: 'Totalt antall elementer: ${total}',
        selected: 'Valgte elementer: ${total}',
    },
    Form: {
        optional: '(valgfritt)',
    },
    Image: {
        preview: 'Forhåndsvis',
        loading: 'Laster inn',
        loadError: 'Kunne ikke laste inn',
        prevTip: 'Forrige',
        nextTip: 'Neste',
        zoomInTip: 'Zoom inn',
        zoomOutTip: 'Zoom ut',
        rotateTip: 'Rotér',
        downloadTip: 'Last ned',
        adaptiveTip: 'Tilpass til siden',
        originTip: 'Opprinnelig størrelse',
    },
    Chat: {
        deleteConfirm: 'Er du sikker på at du vil slette denne økten?',
        clearContext: 'Kontekst tømt',
        copySuccess: 'Kopiert.',
        stop: 'Stopp',
        copy: 'Kopier',
        copied: 'Kopiert',
        dropAreaText: 'Slipp filen her',
    },
    UserGuide: {
        skip: 'Hopp over',
        next: 'Neste',
        prev: 'Forrige',
        finish: 'Fullfør',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Søk',
        replace: 'Erstatt',
        replaceAll: 'Erstatt alt',
    },
    VideoPlayer: {
        rateChange: 'Bytt hastighet til ${rate}',
        qualityChange: 'Bytt kvalitet til ${quality}',
        routeChange: 'Bytt rute til ${route}',
        mirror: 'Speil',
        cancelMirror: 'Avbryt speiling',
        loading: 'Laster inn',
        stall: 'Innlastingen mislyktes',
        noResource: 'Ingen ressurs',
        videoError: 'Feil under videoinnlasting',
    },
    AIChatDialogue: {
        delete: 'Slett',
        deleteConfirm: 'Er du sikker på at du vil slette denne meldingen?',
        deleteContent: 'Denne meldingen slettes for godt og kan ikke gjenopprettes.',
        copySuccess: 'Kopiert',
        loading: 'Laster inn …',
        reasoning: {
            completed: 'Begrunnelsen er fullført',
            thinking: 'Tenker …'
        },
        annotationText: 'dokumenter'
    },
    Feedback: {
        submit: 'Send inn',
        cancel: 'Avbryt'
    },
    AIChatInput: {
        template: 'Mal',
        configure: 'Konfigurer',
        selected: '${count} elementer er valgt',
    }
};

export default local;