
import { id } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'ceb-PH',
    dateFnsLocale: id,
    currency: 'PHP',
    Pagination: {
        pageSize: 'Mga aytem kada page: ${pageSize}',
        total: 'Kinatibuk-ang page: ${total}',
        jumpTo: 'Adto sa',
        page: ' page',
    },
    Modal: {
        confirm: 'Kumpirmahon',
        cancel: 'Kanselahon',
    },
    Tabs: {
        more: "Uban pa"
    },
    TimePicker: {
        placeholder: {
            time: 'Pagpili og oras',
            timeRange: 'Pagpili og range sa oras',
        },
        begin: 'Oras sa Pagsugod',
        end: 'Oras sa Pagtapos',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'Pagpili og petsa',
            dateTime: 'Pagpili og petsa ug oras',
            dateRange: ['Petsa sa pagsugod', 'Petsa sa pagtapos'],
            dateTimeRange: ['Petsa sa pagsugod', 'Petsa sa pagtapos'],
            monthRange: ['Bulan sa pagsugod', 'Bulan sa pagtapos'],
        },
        presets: 'Mga Preset',
        footer: {
            confirm: 'Kumpirmahon',
            cancel: 'Kanselahon',
        },
        selectDate: 'Pagpili og Petsa',
        selectTime: 'Pagpili og Oras',
        year: 'tuig',
        month: 'bulan',
        day: 'adlaw',
        monthText: '${month} ${year}',
        months: {
            1: 'Ene',
            2: 'Peb',
            3: 'Mar',
            4: 'Abr',
            5: 'Mayo',
            6: 'Hun',
            7: 'Hul',
            8: 'Ago',
            9: 'Sep',
            10: 'Okt',
            11: 'Nob',
            12: 'Dis',
        },
        fullMonths: {
            1: 'Enero',
            2: 'Pebrero',
            3: 'Marso',
            4: 'Abril',
            5: 'Mayo',
            6: 'Hunyo',
            7: 'Hulyo',
            8: 'Agosto',
            9: 'Septyembre',
            10: 'Oktubre',
            11: 'Nobyembre',
            12: 'Disyembre',
        },
        weeks: {
            Mon: 'Lun',
            Tue: 'Mar',
            Wed: 'Miy',
            Thu: 'Huw',
            Fri: 'Biy',
            Sat: 'Sab',
            Sun: 'Dom',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'MM/dd/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Kumpirmahon',
        cancel: 'Kanselahon',
    },
    Navigation: {
        collapseText: 'I-collapse ang Sidebar',
        expandText: 'Padak-a ang Sidebar',
    },
    Table: {
        emptyText: 'Walay Resulta',
        pageText: 'Ginapakita ang ${currentStart} hangtod sa ${currentEnd} sa ${total}',
        descend: 'Pindota aron mopaubos',
        ascend: 'Pindota aron mopataas',
        cancelSort: 'Kanselahon ang pag-sort',
    },
    Select: {
        emptyText: 'Walay Resulta',
        createText: 'Paghimo',
    },
    Cascader: {
        emptyText: 'Walay Resulta',
    },
    Tree: {
        emptyText: 'Walay Resulta',
        searchPlaceholder: 'Pangitaa',
    },
    List: {
        emptyText: 'Walay Resulta',
    },
    Calendar: {
        allDay: 'Tibuok Adlaw',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} pa',
    },
    Upload: {
        mainText: 'Pindota aron Mag-upload og File o I-drag ang File dinhi',
        illegalTips: 'Wala ginasuportahan kini nga klase sa file',
        legalTips: 'Ipagawas ug sugdi ang pag-upload',
        retry: 'Sulayi pag-usab',
        replace: 'Pulihan ang File',
        clear: 'I-clear',
        selectedFiles: 'Mga Napili nga File',
        illegalSize: 'Ilegal nga gidak-on sa file',
        fail: 'Napakyas ang pag-upload',
    },
    TreeSelect: {
        searchPlaceholder: 'Pangitaa',
    },
    Typography: {
        copy: 'Kopyaha',
        copied: 'Nakopya na',
        expand: 'Padak-on',
        collapse: 'I-collapse',
    },
    Transfer: {
        emptyLeft: 'Walay Data',
        emptySearch: 'Walay resulta sa pagpangita',
        emptyRight: 'Walay content, susiha gikan sa wala',
        placeholder: 'Pangitaa',
        clear: 'I-clear',
        selectAll: 'Pilia tanan',
        clearSelectAll: 'I-unselect ang tanan',
        total: 'Kinatibuk-ang aytem: ${total}',
        selected: 'Mga napili nga aytem: ${total}',
    },
    Form: {
        optional: '(opsyonal)',
    },
    Image: {
        preview: 'Preview',
        loading: 'Naga-load',
        loadError: 'Wala na-load',
        prevTip: 'Miagi',
        nextTip: 'Sunod',
        zoomInTip: 'I-zoom in',
        zoomOutTip: 'I-zoom out',
        rotateTip: 'I-rotate',
        downloadTip: 'I-download',
        adaptiveTip: 'Ipahiangay sa page',
        originTip: 'Orihinal nga gidak-on',
    },
    Chat: {
        deleteConfirm: 'Sigurado ba ka nga gusto nimong tangtangon kini nga sesyon?',
        clearContext: 'Na-clear na ang konteksto',
        copySuccess: 'Nagmalampuson ang pagkopya.',
        stop: 'Ihunong',
        copy: 'Kopyaha',
        copied: 'Nakopya na',
        dropAreaText: 'Ibutang ang file dinhi',
    },
    UserGuide: {
        skip: 'Laktawan',
        next: 'Sunod',
        prev: 'Prev',
        finish: 'Humanon',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Pangitaa',
        replace: 'Pulihan',
        replaceAll: 'Pulihan Tanan',
    },
    VideoPlayer: {
        rateChange: 'Ibalhin ang rate sa ${rate}',
        qualityChange: 'Ibalhin ang kalidad sa ${quality}',
        routeChange: 'Ibalhin ang ruta sa ${route}',
        mirror: 'I-mirror',
        cancelMirror: 'Kanselahon ang pag-mirror',
        loading: 'Naga-load...',
        stall: 'Napakyas ang pag-load',
        noResource: 'Walay resource',
        videoError: 'Error sa pag-load sa video',
    },
    AIChatDialogue: {
        delete: 'Tangtangon',
        deleteConfirm: 'Sigurado ba ka nga gusto nimong tangtangon kini nga mensahe?',
        deleteContent: 'Permanenteng tangtangon kini nga mensahe ug dili na ma-recover.',
        copySuccess: 'Nagmalampuson ang pagkopya',
        loading: 'Naga-load...',
        reasoning: {
            completed: 'Nakumpleto na ang pangatarungan',
            thinking: 'Nagahunahuna...'
        },
        annotationText: 'ka mga piraso sa impormasyon'
    },
    Feedback: {
        submit: 'Isumite',
        cancel: 'Kanselahon'
    },
    AIChatInput: {
        template: 'Template',
        configure: 'I-configure',
        selected: 'Napili ang ${count} ka mga aytem',
    }
};

export default local;