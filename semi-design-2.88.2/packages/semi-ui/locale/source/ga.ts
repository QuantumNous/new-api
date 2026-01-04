import { fr } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'ga',
    dateFnsLocale: fr,
    currency: 'USD',
    Pagination: {
        pageSize: 'Míreanna in aghaidh an leathanaigh: ${pageSize}',
        total: 'Leathanaigh iomlána: ${total}',
        jumpTo: 'Léim chuig',
        page: ' leathanach',
    },
    Modal: {
        confirm: 'Deimhnigh',
        cancel: 'Cealaigh',
    },
    Tabs: {
        more: "Tuilleadh"
    },
    TimePicker: {
        placeholder: {
            time: 'Roghnaigh am',
            timeRange: 'Roghnaigh raon ama',
        },
        begin: 'Am Tosaigh',
        end: 'Am Deiridh',
        hour: '',
        minute: '',
        second: '',
        AM: 'RN',
        PM: 'IN',
    },
    DatePicker: {
        placeholder: {
            date: 'Roghnaigh dáta',
            dateTime: 'Roghnaigh dáta agus am',
            dateRange: ['Dáta tosaigh', 'Dáta deiridh'],
            dateTimeRange: ['Dáta tosaigh', 'Dáta deiridh'],
            monthRange: ['Mí tosaigh', 'Mí deiridh'],
        },
        presets: 'Réamhshocruithe',
        footer: {
            confirm: 'Deimhnigh',
            cancel: 'Cealaigh',
        },
        selectDate: 'Roghnaigh Dáta',
        selectTime: 'Roghnaigh Am',
        year: 'bliain',
        month: 'mí',
        day: 'lá',
        monthText: '${month} ${year}',
        months: {
            1: 'Ean',
            2: 'Feab',
            3: 'Már',
            4: 'Aib',
            5: 'Beal',
            6: 'Meith',
            7: 'Iúil',
            8: 'Lún',
            9: 'M.Fó',
            10: 'D.Fó',
            11: 'Samh',
            12: 'Nol',
        },
        fullMonths: {
            1: 'Eanáir',
            2: 'Feabhra',
            3: 'Márta',
            4: 'Aibreán',
            5: 'Bealtaine',
            6: 'Meitheamh',
            7: 'Iúil',
            8: 'Lúnasa',
            9: 'Meán Fómhair',
            10: 'Deireadh Fómhair',
            11: 'Samhain',
            12: 'Nollag',
        },
        weeks: {
            Mon: 'Luan',
            Tue: 'Máirt',
            Wed: 'Céad',
            Thu: 'Déar',
            Fri: 'Aoi',
            Sat: 'Sath',
            Sun: 'Domh',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/MM/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Deimhnigh',
        cancel: 'Cealaigh',
    },
    Navigation: {
        collapseText: 'Laghdaigh Taobh-bharra',
        expandText: 'Leathnaigh Taobh-bharra',
    },
    Table: {
        emptyText: 'Gan Toradh',
        pageText: 'Ag taispeáint ${currentStart} go ${currentEnd} go ${total}',
        descend: 'Cliceáil chun tuirlingt',
        ascend: 'Cliceáil chun dreapadh',
        cancelSort: 'Cealaigh sórtáil',
    },
    Select: {
        emptyText: 'Gan Toradh',
        createText: 'Cruthaigh',
    },
    Cascader: {
        emptyText: 'Gan Toradh',
    },
    Tree: {
        emptyText: 'Gan Toradh',
        searchPlaceholder: 'Cuardaigh',
    },
    List: {
        emptyText: 'Gan Toradh',
    },
    Calendar: {
        allDay: 'Lá ar Fad',
        AM: '${time} RN',
        PM: '${time} IN',
        datestring: '',
        remaining: 'tuilleadh ${remained}',
    },
    Upload: {
        mainText: 'Cliceáil chun Comhad a Uaslódáil nó Tarraing Comhad anseo',
        illegalTips: 'Ní thacaítear leis an gcineál comhaid seo.',
        legalTips: 'Scaoileadh agus tosnaigh ag uaslódáil',
        retry: 'Atriail',
        replace: 'Athraigh Comhad',
        clear: 'Glan',
        selectedFiles: 'Comhaid Roghnaithe',
        illegalSize: 'Méid comhaid neamhdhleathach',
        fail: 'Theip ar an uaslódáil',
    },
    TreeSelect: {
        searchPlaceholder: 'Cuardaigh',
    },
    Typography: {
        copy: 'Cóipeáil',
        copied: 'Cóipeáilte',
        expand: 'Leathnaigh',
        collapse: 'Laghdaigh',
    },
    Transfer: {
        emptyLeft: 'Gan sonraí',
        emptySearch: 'Gan torthaí cuardaigh',
        emptyRight: 'Gan ábhar, seiceáil ón taobh clé',
        placeholder: 'Cuardaigh',
        clear: 'Glan',
        selectAll: 'Roghnaigh gach rud',
        clearSelectAll: 'Díroghnaigh gach rud',
        total: 'Earraí iomlán: ${total}',
        selected: 'Earraí roghnaithe: ${total}',
    },
    Form: {
        optional: '(roghnach)',
    },
    Image: {
        preview: 'Réamhamharc',
        loading: 'Ag lódáil',
        loadError: 'Theip ar lódáil',
        prevTip: 'Roimhe seo',
        nextTip: 'Ar aghaidh',
        zoomInTip: 'Zúmáil isteach',
        zoomOutTip: 'Zúmáil amach',
        rotateTip: 'Rothlaigh',
        downloadTip: 'Íoslódáil',
        adaptiveTip: 'Oiriúnaigh don leathanach',
        originTip: 'Méid bunaidh',
    },
    Chat: {
        deleteConfirm: 'An bhfuil tú cinnte gur mhaith leat an seisiún seo a scriosadh?',
        clearContext: 'Comhthéacs glanta',
        copySuccess: 'Cóip rathúil.',
        stop: 'Stop',
        copy: 'Cóipeáil',
        copied: 'Cóipeáilte',
        dropAreaText: 'Cuir an comhad anseo',
    },
    UserGuide: {
        skip: 'Léim thar',
        next: 'Ar aghaidh',
        prev: 'Roimhe seo',
        finish: 'Críochnaigh',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Cuardaigh',
        replace: 'Ionadaigh',
        replaceAll: 'Ionadaigh gach ceann',
    },
    VideoPlayer: {
        rateChange: 'Athraigh an ráta go ${rate}',
        qualityChange: 'Athraigh an caighdeán go ${quality}',
        routeChange: 'Athraigh an bealach go ${route}',
        mirror: 'Scáthán',
        cancelMirror: 'Cealaigh scáthán',
        loading: 'Ag lódáil...',
        stall: 'Theip ar lódáil',
        noResource: 'Gan acmhainn',
        videoError: 'Earráid le lódáil físeán',
    },
    AIChatDialogue: {
        delete: 'Scrios',
        deleteConfirm: 'An bhfuil tú cinnte gur mian leat an teachtaireacht seo a scriosadh?',
        deleteContent: 'Scriosfar an teachtaireacht seo go buan agus ní féidir í a fháil ar ais.',
        copySuccess: 'D\'éirigh leis an gcóipeáil',
        loading: 'Ag lódáil...',
        reasoning: {
            completed: 'Réasúnaíocht críochnaithe',
            thinking: 'Ag smaoineamh...'
        },
        annotationText: 'píosaí eolais'
    },
    Feedback: {
        submit: 'Cuir isteach',
        cancel: 'Cealaigh'
    },
    AIChatInput: {
        template: 'Teimpléad',
        configure: 'Cumraigh',
        selected: 'Roghnaíodh ${count} mír',
    }
};

export default local;