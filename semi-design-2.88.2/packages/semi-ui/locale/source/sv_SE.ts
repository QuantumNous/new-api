import { sv } from 'date-fns/locale';
import { Locale } from '../interface';

/**
 * [i18n-Swedish (sv_SE)]
 * 瑞典语
 */

const local: Locale = {
    code: 'sv-SE',
    dateFnsLocale: sv, 
    currency: 'SEK',
    Pagination: {
        pageSize: 'Artiklar per sida: ${pageSize}',
        total: 'Totalt antal sidor: ${total}',
        jumpTo: 'Gå till',
        page: 'sida',
    },
    Modal: {
        confirm: 'Bekräfta',
        cancel: 'Avbryt',
    },
    Tabs: {
        more: "Mer"
    },
    TimePicker: {
        placeholder: {
            time: 'Välj tid',
            timeRange: 'Välj ett tidsintervall',
        },
        begin: 'Starttid',
        end: 'Sluttid',
        hour: '',
        minute: '',
        second: '',
        AM: '',
        PM: '',
    },
    DatePicker: {
        placeholder: {
            date: 'Välj datum',
            dateTime: 'Välj datum och tid',
            dateRange: ['Startdatum', 'Slutdatum'],
            dateTimeRange: ['Startdatum', 'Slutdatum'],
            monthRange: ['Startmånad', 'Slutmånad'],
        },
        presets: 'Snabbval',
        footer: {
            confirm: 'Bekräfta',
            cancel: 'Avbryt',
        },
        selectDate: 'Välj datum',
        selectTime: 'Välj tid',
        year: '',
        month: '',
        day: '',
        monthText: '${month} ${year}',
        months: {
            1: 'Jan',
            2: 'Feb',
            3: 'Mar',
            4: 'Apr',
            5: 'Maj',
            6: 'Jun',
            7: 'Jul',
            8: 'Aug',
            9: 'Sep',
            10: 'Okt',
            11: 'Nov',
            12: 'Dec',
        },
        fullMonths: {
            1: 'Januari',
            2: 'Februari',
            3: 'Mars',
            4: 'April',
            5: 'Maj',
            6: 'Juni',
            7: 'Juli',
            8: 'Augusti',
            9: 'September',
            10: 'Oktober',
            11: 'November',
            12: 'December',
        },
        weeks: {
            Mon: 'Mån',
            Tue: 'Tis',
            Wed: 'Ons',
            Thu: 'Tor',
            Fri: 'Fre',
            Sat: 'Lör',
            Sun: 'Sön',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'yyyy-MM-dd',
        },
    },
    Navigation: {
        collapseText: 'Dölj sidofält',
        expandText: 'Visa sidofält',
    },
    Popconfirm: {
        confirm: 'Bekräfta',
        cancel: 'Avbryt',
    },
    Table: {
        emptyText: 'Inga resultat hittades',
        pageText: 'Visar ${currentStart} till ${currentEnd} av ${total}',
        descend: 'Klicka för att sortera fallande',
        ascend: 'Klicka för att sortera stigande',
        cancelSort: 'Avbryt sortering',
    },
    Select: {
        emptyText: 'Inga resultat hittades',
        createText: 'Skapa',
    },
    Cascader: {
        emptyText: 'Inga resultat hittades',
    },
    Tree: {
        emptyText: 'Inga resultat hittades',
        searchPlaceholder: 'Sök',
    },
    List: {
        emptyText: 'Inga resultat hittades',
    },
    Calendar: {
        allDay: 'Hela dagen',
        AM: '${time}',
        PM: '${time}',
        datestring: '',
        remaining: '${remained} till',
    },
    Upload: {
        mainText: 'Klicka för att välja en fil eller dra den hit för att ladda upp',
        illegalTips: 'Den här filtypen stöds inte',
        legalTips: 'Släpp för att börja ladda upp',
        retry: 'Försök igen',
        replace: 'Byt ut fil',
        clear: 'Rensa',
        selectedFiles: 'Valda filer',
        illegalSize: 'Ogiltig filstorlek',
        fail: 'Det gick inte att ladda upp',
    },
    TreeSelect: {
        searchPlaceholder: 'Sök',
    },
    Typography: {
        copy: 'Kopiera',
        copied: 'Kopierad',
        expand: 'Visa mer',
        collapse: 'Dölj',
    },
    Transfer: {
        emptyLeft: 'Inga data',
        emptySearch: 'Inga sökresultat',
        emptyRight: 'Valda objekt kommer att visas här. Välj ett objekt till vänster',
        placeholder: 'Sök',
        clear: 'Rensa',
        selectAll: 'Markera alla',
        clearSelectAll: 'Avmarkera alla',
        total: 'Totalt antal artiklar: ${total}',
        selected: 'Valda artiklar: ${total}',
    },
    Form: {
        optional: '(Frivilligt)',
    },
    Image: {
        preview: 'Förhandsgranskning',
        loading: 'Läser in',
        loadError: 'Det gick inte att läsa in',
        prevTip: 'Föregående',
        nextTip: 'Nästa',
        zoomInTip: 'Zooma in',
        zoomOutTip: 'Zooma ut',
        rotateTip: 'Rotera',
        downloadTip: 'Ladda ned',
        adaptiveTip: 'Adaptiv visning',
        originTip: 'Standardvisning',
    },
    Chat: {
        deleteConfirm: 'Är du säker på att du vill ta bort denna konversation?',
        clearContext: 'Kontexten har rensats',
        copySuccess: 'Kopiering lyckades',
        stop: 'Stoppa',
        copy: 'Kopiera',
        copied: 'Kopierad',
        dropAreaText: 'Placera filen här',   
    }, 
    UserGuide: {
        skip: 'Hoppa över',
        next: 'Nästa',
        prev: 'Föregående',
        finish: 'Slutför',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Sök',
        replace: 'Ersätt',
        replaceAll: 'Ersätt alla',
    },
    VideoPlayer: {
        rateChange: 'Ändra hastighet till ${rate}',
        qualityChange: 'Ändra kvalitet till ${quality}',
        routeChange: 'Ändra väg till ${route}',
        mirror: 'Spegel',
        cancelMirror: 'Ta bort spegel',
        loading: 'Läser in...',
        stall: 'Läsning misslyckades',
        noResource: 'Ingen resurs',
        videoError: 'Fel vid inläsning av video'
    },
    AIChatDialogue: {
        delete: 'Ta bort',
        deleteConfirm: 'Är du säker på att du vill ta bort denna konversation?',
        deleteContent: 'Konversationen har tagits bort.',
        copySuccess: 'Kopiering lyckades',
        loading: 'Läser in...',
        reasoning: {
            completed: 'Procesering slutförd',
            thinking: 'Procesering pågår...'
        },
        annotationText: 'informationselement'
    },
    Feedback: {
        submit: 'Skicka',
        cancel: 'Avbryt'
    },
    AIChatInput: {
        template: 'Stencil',
        configure: 'Konfiguration',
        selected: '${count} objekt valda',
    }
};

export default local;
