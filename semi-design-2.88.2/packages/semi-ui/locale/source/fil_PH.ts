import { id } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'fil-PH',
    dateFnsLocale: id,
    currency: 'PHP',
    Pagination: {
        pageSize: 'Mga item sa bawat page: ${pageSize}',
        total: 'Kabuuang page: ${total}',
        jumpTo: 'Pumunta sa',
        page: ' page',
    },
    Modal: {
        confirm: 'Kumpirmahin',
        cancel: 'Kanselahin',
    },
    Tabs: {
        more: "Higit pa"
    },
    TimePicker: {
        placeholder: {
            time: 'Pumili ng oras',
            timeRange: 'Pumili ng range ng oras',
        },
        begin: 'Oras ng Pagsisimula',
        end: 'Oras ng Pagtatapos',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'Pumili ng petsa',
            dateTime: 'Pumili ng petsa at oras',
            dateRange: ['Petsa ng pagsisimula', 'Petsa ng pagtatapos'],
            dateTimeRange: ['Petsa ng pagsisimula', 'Petsa ng pagtatapos'],
            monthRange: ['Buwan ng pagsisimula', 'Buwan ng pagtatapos'],
        },
        presets: 'Mga Preset',
        footer: {
            confirm: 'Kumpirmahin',
            cancel: 'Kanselahin',
        },
        selectDate: 'Pumili ng Petsa',
        selectTime: 'Pumili ng Oras',
        year: 'taon',
        month: 'buwan',
        day: 'araw',
        monthText: '${month} ${year}',
        months: {
            1: 'Ene',
            2: 'Peb',
            3: 'Mar',
            4: 'Abr',
            5: 'May',
            6: 'Hun',
            7: 'Hul',
            8: 'Ago',
            9: 'Set',
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
            9: 'Setyembre',
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
            Sun: 'Lin',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'MM/dd/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Kumpirmahin',
        cancel: 'Kanselahin',
    },
    Navigation: {
        collapseText: 'I-collapse ang sidebar',
        expandText: 'I-expand ang Sidebar',
    },
    Table: {
        emptyText: 'Walang Resulta',
        pageText: 'Ipinapakita ang ${currentStart} hanggang ${currentEnd} ng ${total}',
        descend: 'I-click para pababa',
        ascend: 'I-click para pataas',
        cancelSort: 'Kanselahin ang pag-sort',
    },
    Select: {
        emptyText: 'Walang Resulta',
        createText: 'Gumawa',
    },
    Cascader: {
        emptyText: 'Walang Resulta',
    },
    Tree: {
        emptyText: 'Walang Resulta',
        searchPlaceholder: 'Maghanap',
    },
    List: {
        emptyText: 'Walang Resulta',
    },
    Calendar: {
        allDay: 'Buong Araw',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} pa',
    },
    Upload: {
        mainText: 'I-click para Mag-upload ng File o Mag-drag ng File dito',
        illegalTips: 'Hindi sinusuportahan ang ganitong uri ng file',
        legalTips: 'Bitawan at simulan ang pag-upload',
        retry: 'Subukan ulit',
        replace: 'Palitan ang File',
        clear: 'I-clear',
        selectedFiles: 'Mga Napiling File',
        illegalSize: 'Di-wastong laki ng file',
        fail: 'Nabigo ang pag-upload',
    },
    TreeSelect: {
        searchPlaceholder: 'Maghanap',
    },
    Typography: {
        copy: 'Kopyahin',
        copied: 'Nakopya na',
        expand: 'I-expand',
        collapse: 'I-collapse',
    },
    Transfer: {
        emptyLeft: 'Walang Data',
        emptySearch: 'Walang resulta sa paghahanap',
        emptyRight: 'Walang content, i-check mula sa kaliwang bahagi',
        placeholder: 'Maghanap',
        clear: 'I-clear',
        selectAll: 'Piliin lahat',
        clearSelectAll: 'I-unselect lahat',
        total: 'Kabuuang item: ${total}',
        selected: 'Mga napiling item: ${total}',
    },
    Form: {
        optional: '(opsyonal)',
    },
    Image: {
        preview: 'I-preview',
        loading: 'Naglo-load',
        loadError: 'Hindi nag-load',
        prevTip: 'Nauna',
        nextTip: 'Susunod',
        zoomInTip: 'I-zoom in',
        zoomOutTip: 'I-zoom out',
        rotateTip: 'I-rotate',
        downloadTip: 'I-download',
        adaptiveTip: 'Iangkop sa page',
        originTip: 'Orihinal na laki',
    },
    Chat: {
        deleteConfirm: 'Sigurado ka bang gusto mong i-delete ang session na ito?',
        clearContext: 'Na-clear na ang konteksto',
        copySuccess: 'Matagumpay na nakopya.',
        stop: 'Ihinto',
        copy: 'Kopyahin',
        copied: 'Nakopya na',
        dropAreaText: 'Ilagay ang file dito',
    },
    UserGuide: {
        skip: 'Laktawan',
        next: 'Susunod',
        prev: 'Prev',
        finish: 'Tapos na',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Maghanap',
        replace: 'Palitan',
        replaceAll: 'Palitan Lahat',
    },
    VideoPlayer: {
        rateChange: 'Gawing ${rate} ang rate',
        qualityChange: 'Gawing ${quality} ang kalidad',
        routeChange: 'Gawing ${route} ang route',
        mirror: 'Mirror',
        cancelMirror: 'Kanselahin ang mirror',
        loading: 'Naglo-load...',
        stall: 'Nabigong mag-load',
        noResource: 'Walang resource',
        videoError: 'Error sa pag-load ng video',
    },
    AIChatDialogue: {
        delete: 'I-delete',
        deleteConfirm: 'Sigurado ka bang gusto mong i-delete ang mensaheng ito?',
        deleteContent: 'Permanenteng ide-delete ang mensaheng ito at hindi na mare-recover.',
        copySuccess: 'Matagumpay na nakopya',
        loading: 'Naglo-load...',
        reasoning: {
            completed: 'Nakumpleto na ang pangangatwiran',
            thinking: 'Nag-iisip...'
        },
        annotationText: '(na) uri ng impormasyon'
    },
    Feedback: {
        submit: 'Isumite',
        cancel: 'Kanselahin'
    },
    AIChatInput: {
        template: 'Template',
        configure: 'I-configure',
        selected: 'Napili ang ${count} (na) item',
    }
};

export default local;