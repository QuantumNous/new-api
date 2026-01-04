import { lv } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'lv',
    dateFnsLocale: lv,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Vienumi lapā: ${pageSize}',
        total: 'Kopā lapas: ${total}',
        jumpTo: 'Pāriet uz',
        page: ' lapu',
    },
    Modal: {
        confirm: 'Apstiprināt',
        cancel: 'Atcelt',
    },
    Tabs: {
        more: "Vairāk"
    },
    TimePicker: {
        placeholder: {
            time: 'Atlasi laiku',
            timeRange: 'Atlasi laika diapazonu',
        },
        begin: 'Sākuma laiks',
        end: 'Beigu laiks',
        hour: '',
        minute: '',
        second: '',
        AM: 'pirms pusdienas',
        PM: 'pēc pusdienas',
    },
    DatePicker: {
        placeholder: {
            date: 'Atlasi datumu',
            dateTime: 'Atlasi datumu un laiku',
            dateRange: ['Sākuma datums', 'Beigu datums'],
            dateTimeRange: ['Sākuma datums', 'Beigu datums'],
            monthRange: ['Sākuma mēnesis', 'Beigu mēnesis'],
        },
        presets: 'Sākotnējie iestatījumi',
        footer: {
            confirm: 'Apstiprināt',
            cancel: 'Atcelt',
        },
        selectDate: 'Atlasi datumu',
        selectTime: 'Atlasi laiku',
        year: 'gads',
        month: 'mēnesis',
        day: 'diena',
        monthText: '${month} ${year}',
        months: {
            1: 'Janv.',
            2: 'Febr.',
            3: 'Marts',
            4: 'Apr.',
            5: 'Maijs',
            6: 'Jūn.',
            7: 'Jūl.',
            8: 'Aug.',
            9: 'Sept.',
            10: 'Okt.',
            11: 'Nov.',
            12: 'Dec.',
        },
        fullMonths: {
            1: 'Janvāris',
            2: 'Februāris',
            3: 'Marts',
            4: 'Aprīlis',
            5: 'Maijs',
            6: 'Jūnijs',
            7: 'Jūlijs',
            8: 'Augusts',
            9: 'Septembris',
            10: 'Oktobris',
            11: 'Novembris',
            12: 'Decembris',
        },
        weeks: {
            Mon: 'P.',
            Tue: 'O.',
            Wed: 'T.',
            Thu: 'C.',
            Fri: 'Pk.',
            Sat: 'S.',
            Sun: 'Sv.',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'MM/dd/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Apstiprināt',
        cancel: 'Atcelt',
    },
    Navigation: {
        collapseText: 'Sakļaut sānu joslu',
        expandText: 'Izvērst sānu joslu',
    },
    Table: {
        emptyText: 'Nav rezultāta',
        pageText: 'Rāda ${currentStart}.–${currentEnd}. no ${total}',
        descend: 'Klikšķini, lai skatītu dilstošā secībā',
        ascend: 'Klikšķini, lai skatītu augošā secībā',
        cancelSort: 'Atcelt kārtošanu',
    },
    Select: {
        emptyText: 'Nav rezultāta',
        createText: 'Izveidot',
    },
    Cascader: {
        emptyText: 'Nav rezultāta',
    },
    Tree: {
        emptyText: 'Nav rezultāta',
        searchPlaceholder: 'Meklēt',
    },
    List: {
        emptyText: 'Nav rezultāta',
    },
    Calendar: {
        allDay: 'Visu dienu',
        AM: '${time} pirms pusdienas',
        PM: '${time} pēc pusdienas',
        datestring: '',
        remaining: 'vēl ${remained}',
    },
    Upload: {
        mainText: 'Noklikšķini, lai augšupielādētu failu, vai velc failu šeit',
        illegalTips: 'Šāda veida fails netiek atbalstīts',
        legalTips: 'Atlaid un sāc augšupielādēt',
        retry: 'Mēģināt vēlreiz',
        replace: 'Aizvietot failu',
        clear: 'Notīrīt',
        selectedFiles: 'Atlasītie faili',
        illegalSize: 'Nederīgs faila lielums',
        fail: 'Augšupielāde neizdevās',
    },
    TreeSelect: {
        searchPlaceholder: 'Meklēt',
    },
    Typography: {
        copy: 'Kopēt',
        copied: 'Nokopēts',
        expand: 'Izvērst',
        collapse: 'Sakļaut',
    },
    Transfer: {
        emptyLeft: 'Nav datu',
        emptySearch: 'Nav meklēšanas rezultātu',
        emptyRight: 'Nav satura, pārbaudi kreisajā pusē',
        placeholder: 'Meklēt',
        clear: 'Notīrīt',
        selectAll: 'Atlasīt visu',
        clearSelectAll: 'Noņemt atlasi no visa',
        total: 'Kopā vienumi: ${total}',
        selected: 'Atlasītie vienumi: ${total}',
    },
    Form: {
        optional: '(neobligāti)',
    },
    Image: {
        preview: 'Priekšskatījums',
        loading: 'Notiek ielāde...',
        loadError: 'Neizdevās ielādēt',
        prevTip: 'Atpakaļ',
        nextTip: 'Tālāk',
        zoomInTip: 'Tuvināt',
        zoomOutTip: 'Tālināt',
        rotateTip: 'Rotēt',
        downloadTip: 'Lejupielādēt',
        adaptiveTip: 'Pielāgot lapai',
        originTip: 'Sākotnējais lielums',
    },
    Chat: {
        deleteConfirm: 'Vai tiešām vēlies dzēst šo sesiju?',
        clearContext: 'Konteksts ir notīrīts',
        copySuccess: 'Veiksmīgi nokopēts.',
        stop: 'Pārtraukt',
        copy: 'Kopēt',
        copied: 'Nokopēts',
        dropAreaText: 'Ievietojiet failu šeit',
    },
    UserGuide: {
        skip: 'Izlaist',
        next: 'Tālāk',
        prev: 'Atpakaļ',
        finish: 'Beigt',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Meklēt',
        replace: 'Aizstāt',
        replaceAll: 'Aizstāt visu',
    },
    VideoPlayer: {
        rateChange: 'Pārslēgt ātrumu uz ${rate}',
        qualityChange: 'Pārslēgt kvalitāti uz ${quality}',
        routeChange: 'Pārslēgt maršrutu uz ${route}',
        mirror: 'Spoguļot',
        cancelMirror: 'Atcelt spoguļošanu',
        loading: 'Notiek ielāde...',
        stall: 'Ielāde neizdevās',
        noResource: 'Nav resursu',
        videoError: 'Video ielādes kļūda',
    },
    AIChatDialogue: {
        delete: 'Dzēst',
        deleteConfirm: 'Vai tiešām vēlies dzēst šo ziņu?',
        deleteContent: 'Šī ziņa tiks neatgriezeniski dzēsta, un to nevarēs atgūt.',
        copySuccess: 'Veiksmīgi nokopēts',
        loading: 'Notiek ielāde...',
        reasoning: {
            completed: 'Pamatojums ir pabeigts',
            thinking: 'Domā...'
        },
        annotationText: 'informācijas fragmenti'
    },
    Feedback: {
        submit: 'Iesniegt',
        cancel: 'Atcelt'
    },
    AIChatInput: {
        template: 'Veidne',
        configure: 'Konfigurēt',
        selected: 'Atlasīto vienumu skaits: ${count}',
    }
};

export default local;