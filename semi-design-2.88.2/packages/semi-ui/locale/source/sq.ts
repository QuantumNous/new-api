import { sq } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'sq',
    dateFnsLocale: sq,
    currency: 'ALL',
    Pagination: {
        pageSize: 'Artikuj për faqe: ${pageSize}',
        total: 'Faqe në total: ${total}',
        jumpTo: 'Shko te',
        page: ' faqja',
    },
    Modal: {
        confirm: 'Konfirmo',
        cancel: 'Anulo',
    },
    Tabs: {
        more: "Më shumë"
    },
    TimePicker: {
        placeholder: {
            time: 'Zgjidh orën',
            timeRange: 'Zgjidh periudhën kohore',
        },
        begin: 'Ora e fillimit',
        end: 'Ora e mbarimit',
        hour: '',
        minute: '',
        second: '',
        AM: 'Paradite',
        PM: 'Pasdite',
    },
    DatePicker: {
        placeholder: {
            date: 'Zgjidh datën',
            dateTime: 'Zgjidh datën dhe orën',
            dateRange: ['Data e fillimit', 'Data e mbarimit'],
            dateTimeRange: ['Data e fillimit', 'Data e mbarimit'],
            monthRange: ['Muaji i fillimit', 'Muaji i mbarimit'],
        },
        presets: 'Paracaktime',
        footer: {
            confirm: 'Konfirmo',
            cancel: 'Anulo',
        },
        selectDate: 'Zgjidh datën',
        selectTime: 'Zgjidh orën',
        year: 'viti',
        month: 'muaj',
        day: 'ditë',
        monthText: '${month} ${year}',
        months: {
            1: 'Janar',
            2: 'Shkurt',
            3: 'Mars',
            4: 'Prill',
            5: 'Maj',
            6: 'Qershor',
            7: 'Korrik',
            8: 'Gusht',
            9: 'Shtator',
            10: 'Tetor',
            11: 'Nëntor',
            12: 'Dhjetor',
        },
        fullMonths: {
            1: 'Janar',
            2: 'Shkurt',
            3: 'Mars',
            4: 'Prill',
            5: 'Maj',
            6: 'Qershor',
            7: 'Korrik',
            8: 'Gusht',
            9: 'Shtator',
            10: 'Tetor',
            11: 'Nëntor',
            12: 'Dhjetor',
        },
        weeks: {
            Mon: 'Hën',
            Tue: 'Mar',
            Wed: 'Mër',
            Thu: 'Enj',
            Fri: 'Pre',
            Sat: 'Sht',
            Sun: 'Die',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd.mm.yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Konfirmo',
        cancel: 'Anulo',
    },
    Navigation: {
        collapseText: 'Mbyll shiritin anësor',
        expandText: 'Hap shiritin anësor',
    },
    Table: {
        emptyText: 'Nuk ka rezultat',
        pageText: 'Duke shfaqur ${currentStart} të ${currentEnd} nga ${total}',
        descend: 'Kliko për të zbritur',
        ascend: 'Kliko për të rritur',
        cancelSort: 'Anulo renditjen',
    },
    Select: {
        emptyText: 'Nuk ka rezultat',
        createText: 'Krijo',
    },
    Cascader: {
        emptyText: 'Nuk ka rezultat',
    },
    Tree: {
        emptyText: 'Nuk ka rezultat',
        searchPlaceholder: 'Kërko',
    },
    List: {
        emptyText: 'Nuk ka rezultat',
    },
    Calendar: {
        allDay: 'Gjithë ditën',
        AM: '${time} Paradite',
        PM: '${time} Pasdite',
        datestring: '',
        remaining: '${remained} më shumë',
    },
    Upload: {
        mainText: 'Kliko për të ngarkuar ose zvarrit skedarin këtu',
        illegalTips: 'Ky lloj skedari nuk mbështetet',
        legalTips: 'Lësho dhe fillo ngarkimin',
        retry: 'Provo përsëri',
        replace: 'Zëvendëso skedarin',
        clear: 'Fshi',
        selectedFiles: 'Skedarët e zgjedhur',
        illegalSize: 'Madhësi e papërshtatshme skedari',
        fail: 'Nuk u ngarkua',
    },
    TreeSelect: {
        searchPlaceholder: 'Kërko',
    },
    Typography: {
        copy: 'Kopjo',
        copied: 'U kopjua',
        expand: 'Zgjero',
        collapse: 'Mbyll',
    },
    Transfer: {
        emptyLeft: 'Nuk ka të dhëna',
        emptySearch: 'Kërkimi nuk dha rezultat',
        emptyRight: 'Nuk ka përmbajtje, zgjidh nga opsionet në të majtë',
        placeholder: 'Kërko',
        clear: 'Fshi',
        selectAll: 'Zgjidh të gjitha',
        clearSelectAll: 'Anulo zgjedhjen e të gjithave',
        total: 'Artikuj në total: ${total}',
        selected: 'Artikujt e zgjedhur: ${total}',
    },
    Form: {
        optional: '(opsional)',
    },
    Image: {
        preview: 'Pamja paraprake',
        loading: 'Duke u ngarkuar',
        loadError: 'Nuk u ngarkua',
        prevTip: 'Përpara',
        nextTip: 'Tjetër',
        zoomInTip: 'Zmadho',
        zoomOutTip: 'Zvogëlo',
        rotateTip: 'Rrotullo',
        downloadTip: 'Shkarko',
        adaptiveTip: 'Përshtat sipas faqes',
        originTip: 'Madhësia fillestare',
    },
    Chat: {
        deleteConfirm: 'Vërtet dëshiron ta fshish këtë seancë?',
        clearContext: 'Konteksti u fshi',
        copySuccess: 'U kopjua me sukses.',
        stop: 'Ndalo',
        copy: 'Kopjo',
        copied: 'U kopjua',
        dropAreaText: 'Vendos skedarin këtu',
    },
    UserGuide: {
        skip: 'Anashkalo',
        next: 'Tjetër',
        prev: 'Përpara',
        finish: 'Mbaro',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Kërko',
        replace: 'Zëvendëso',
        replaceAll: 'Zëvendëso të gjitha',
    },
    VideoPlayer: {
        rateChange: 'Ndrysho shpejtësinë në ${rate}',
        qualityChange: 'Ndrysho cilësinë në ${quality}',
        routeChange: 'Ndrysho drejtimin kalimin në ${route}',
        mirror: 'Pasqyrë',
        cancelMirror: 'Anulo pasqyrimin',
        loading: 'Duke u ngarkuar...',
        stall: 'Nuk u ngarkua',
        noResource: 'Nuk ka burim',
        videoError: 'Gabim në ngarkimin e videos',
    },
    AIChatDialogue: {
        delete: 'Fshi',
        deleteConfirm: 'Je i sigurt që do ta fshish këtë mesazh?',
        deleteContent: 'Ky mesazh do të fshihet përgjithmonë dhe nuk mund të rikuperohet.',
        copySuccess: 'U kopjua me sukses',
        loading: 'Duke u ngarkuar...',
        reasoning: {
            completed: 'Arsyetimi përfundoi',
            thinking: 'Duke menduar...'
        },
        annotationText: 'pjesë informacioni'
    },
    Feedback: {
        submit: 'Dërgo',
        cancel: 'Anulo'
    },
    AIChatInput: {
        template: 'Shabllon',
        configure: 'Konfiguro',
        selected: 'Janë përzgjedhur ${count} artikuj',
    }
};

export default local;