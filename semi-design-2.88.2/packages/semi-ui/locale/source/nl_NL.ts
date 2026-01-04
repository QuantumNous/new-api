
import { nl } from 'date-fns/locale';
import { Locale } from '../interface';

/**
 * [i18n-Dutch (nl_NL)]
 * 荷兰语
 *
 */

const local: Locale = {
    code: 'nl-NL',
    dateFnsLocale: nl, // locale code to dateFns locale
    currency: 'EUR',
    Pagination: {
        page: 'pagina',
        pageSize: 'Items per pagina: ${pageSize}',
        total: "Totaal aantal pagina's: ${total}",
        jumpTo: 'Ga naar'
    },
    Modal: {
        confirm: 'Bevestigen',
        cancel: 'Annuleren',
    },
    Tabs: {
        more: "Meer"
    },
    TimePicker: {
        placeholder: {
            time: 'Tijd selecteren',
            timeRange: 'Selecteer een tijdbereik',
        },
        begin: 'Begintijd',
        end: 'Eindtijd',
        hour: '',
        minute: '',
        second: '',
        AM: '',
        PM: '',
    },
    DatePicker: {
        placeholder: {
            date: 'Datum selecteren',
            dateTime: 'Datum en tijd selecteren',
            dateRange: ['Begindatum', 'Einddatum'],
            dateTimeRange: ['Begindatum', 'Einddatum'],
            monthRange: ['Begindatum', 'Einddatum'],
        },
        presets: 'Snelle selectie',
        footer: {
            confirm: 'Bevestigen',
            cancel: 'Annuleren',
        },
        selectDate: 'Datum selecteren',
        selectTime: 'Tijd selecteren',
        year: '',
        month: '',
        day: '',
        monthText: '${month} ${year}',
        months: {
            1: 'jan',
            2: 'feb',
            3: 'mrt',
            4: 'apr',
            5: 'mei',
            6: 'jun',
            7: 'jul',
            8: 'aug',
            9: 'sep',
            10: 'okt',
            11: 'nov',
            12: 'dec',
        },
        fullMonths: {
            1: 'januari',
            2: 'februari',
            3: 'maart',
            4: 'april',
            5: 'mei',
            6: 'juni',
            7: 'juli',
            8: 'augustus',
            9: 'september',
            10: 'oktober',
            11: 'november',
            12: 'december',
        },
        weeks: {
            Mon: 'ma',
            Tue: 'di',
            Wed: 'wo',
            Thu: 'do',
            Fri: 'vr',
            Sat: 'za',
            Sun: 'zo',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'yyyy-MM-dd',
        },
    },
    Navigation: {
        collapseText: 'Zijbalk verbergen',
        expandText: 'Zijbalk weergeven',
    },
    Popconfirm: {
        confirm: 'Bevestigen',
        cancel: 'Annuleren',
    },
    Table: {
        emptyText: 'Geen resultaten gevonden',
        pageText: '${currentStart} tot ${currentEnd} van ${total} wordt weergegeven',
        descend: 'Klik om af te dalen',
        ascend: 'Klik om op te stijgen',
        cancelSort: 'Sorteren annuleren',
    },
    Select: {
        emptyText: 'Geen resultaten gevonden',
        createText: 'Maken',
    },
    Cascader: {
        emptyText: 'Geen resultaten gevonden',
    },
    Tree: {
        emptyText: 'Geen resultaten gevonden',
        searchPlaceholder: 'Zoeken',
    },
    List: {
        emptyText: 'Geen resultaten gevonden',
    },
    Calendar: {
        allDay: 'Hele dag',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: ' nog ${remained}',
    },
    Upload: {
        mainText: 'Klik om een bestand te selecteren of sleep het hierheen om te uploaden',
        illegalTips: 'Dit type bestand wordt niet ondersteund',
        legalTips: 'Loslaten om te beginnen met uploaden',
        retry: 'Opnieuw proberen',
        replace: 'Bestand vervangen',
        clear: 'Wissen',
        selectedFiles: 'Geselecteerde bestanden',
        illegalSize: 'Onjuiste bestandsgrootte',
        fail: 'Kan niet uploaden',
    },
    TreeSelect: {
        searchPlaceholder: 'Zoeken',
    },
    Typography: {
        copy: 'Kopiëren',
        copied: 'Gekopieerd',
        expand: 'Meer weergeven',
        collapse: 'Verbergen',
    },
    Transfer: {
        emptyLeft: 'Geen gegevens',
        emptySearch: 'Geen zoekresultaten',
        emptyRight: 'Geselecteerde items verschijnen hier. Selecteer een item links',
        placeholder: 'Zoeken',
        clear: 'Wissen',
        selectAll: 'Alles selecteren',
        clearSelectAll: 'Alle selecties opheffen',
        total: 'Totaal aantal items: ${total}',
        selected: 'Wybrane pozycje: ${total}',
    },
    Form: {
        optional: 'Optioneel',
    },
    Image: {
        preview: 'Voorbeeld',
        loading: 'Laden',
        loadError: 'Kan niet laden',
        prevTip: 'Vorige',
        nextTip: 'Volgende',
        zoomInTip: 'Inzoomen',
        zoomOutTip: 'Uitzoomen',
        rotateTip: 'Draaien',
        downloadTip: 'Downloaden',
        adaptiveTip: 'Adaptieve weergave',
        originTip: 'Standaardweergave',
    },
    Chat: {
        deleteConfirm: 'Weet u zeker dat u deze conversatie wilt verwijderen?',
        clearContext: 'De context is gewist',
        copySuccess: 'Succesvol gekopieerd',
        stop: 'Stoppen',
        copy: 'Kopiëren',
        copied: 'Gekopieerd',
        dropAreaText: 'Plaats het bestand hier',
    },
    UserGuide: {
        skip: 'Overslaan',
        next: 'Volgende',
        prev: 'Vorige',
        finish: 'Voltooien',
    },  
    InputNumber: {},
    JsonViewer: {
        search: 'Zoeken',
        replace: 'Vervangen',
        replaceAll: 'Alle vervangen',
    },
    VideoPlayer: {
        rateChange: 'Verander snelheid naar ${rate}',
        qualityChange: 'Verander kwaliteit naar ${quality}',
        routeChange: 'Verander route naar ${route}',
        mirror: 'Spiegel',
        cancelMirror: 'Spiegel opheffen',
        loading: 'Laden...',
        stall: 'Laden mislukt',
        noResource: 'Geen bron',
        videoError: 'Fout bij laden video'
    },
    AIChatDialogue: {
        delete: 'Verwijderen',
        deleteConfirm: 'Weet u zeker dat u deze conversatie wilt verwijderen?',
        deleteContent: 'Deze conversatie wordt permanent verwijderd en kan niet worden hersteld.',
        copySuccess: 'Succesvol gekopieerd',
        loading: 'Laden...',
        reasoning: {
            completed: 'Verwerking voltooid',
            thinking: 'Verwerking in uitvoering...'
        },
        annotationText: 'informatie-elementen'
    },
    Feedback: {
        submit: 'Versturen',
        cancel: 'Annuleren'
    },
    AIChatInput: {
        template: 'Stencil',
        configure: 'Configuratie',
        selected: '${count} items geselecteerd',
    }
};

export default local;
