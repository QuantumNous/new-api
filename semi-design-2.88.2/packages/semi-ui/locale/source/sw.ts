import { id } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'sw',
    dateFnsLocale: id,
    currency: 'USD',
    Pagination: {
        pageSize: 'Bidhaa kwa ukurasa: ${pageSize}',
        total: 'Jumla ya kurasa: ${total}',
        jumpTo: 'Ruka hadi',
        page: ' ukurasa',
    },
    Modal: {
        confirm: 'Thibitisha',
        cancel: 'Ghairi',
    },
    Tabs: {
        more: "Zaidi"
    },
    TimePicker: {
        placeholder: {
            time: 'Chagua saa',
            timeRange: 'Chagua kipindi',
        },
        begin: 'Saa ya Kuanza',
        end: 'Saa ya Kumaliza',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'Chagua tarehe',
            dateTime: 'Chagua tarehe na saa',
            dateRange: ['Tarehe ya kuanza', 'Tarehe ya mwisho'],
            dateTimeRange: ['Tarehe ya kuanza', 'Tarehe ya mwisho'],
            monthRange: ['Mwezi wa kuanza', 'Mwezi wa mwisho'],
        },
        presets: 'Mipangilio ya mapema',
        footer: {
            confirm: 'Thibitisha',
            cancel: 'Ghairi',
        },
        selectDate: 'Chagua Tarehe',
        selectTime: 'Chagua Saa',
        year: 'mwaka',
        month: 'mwezi',
        day: 'siku',
        monthText: '${month} ${year}',
        months: {
            1: 'Jan',
            2: 'Feb',
            3: 'Machi',
            4: 'Apr',
            5: 'Mei',
            6: 'Jun',
            7: 'Jul',
            8: 'Ago',
            9: 'Sep',
            10: 'Okt',
            11: 'Nov',
            12: 'Des',
        },
        fullMonths: {
            1: 'Januari',
            2: 'Februari',
            3: 'Machi',
            4: 'Aprili',
            5: 'Mei',
            6: 'Juni',
            7: 'Julai',
            8: 'Agosti',
            9: 'Septemba',
            10: 'Oktoba',
            11: 'Novemba',
            12: 'Desemba',
        },
        weeks: {
            Mon: 'J\'tatu',
            Tue: 'J\'nne',
            Wed: 'J\'tano',
            Thu: 'Alh',
            Fri: 'Ijumaa',
            Sat: 'J\'mosi',
            Sun: 'J\'pili',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/MM/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Thibitisha',
        cancel: 'Ghairi',
    },
    Navigation: {
        collapseText: 'Kunja Utepe',
        expandText: 'Panua Utepe',
    },
    Table: {
        emptyText: 'Hakuna Matokeo',
        pageText: 'Inaonyesha ukurasa wa ${currentStart} hadi ${currentEnd} kati ya ${total}',
        descend: 'Bofya ili ushuke chini',
        ascend: 'Bofya ili upande juu',
        cancelSort: 'Ghairi upangaji',
    },
    Select: {
        emptyText: 'Hakuna Matokeo',
        createText: 'Buni',
    },
    Cascader: {
        emptyText: 'Hakuna Matokeo',
    },
    Tree: {
        emptyText: 'Hakuna Matokeo',
        searchPlaceholder: 'Tafuta',
    },
    List: {
        emptyText: 'Hakuna Matokeo',
    },
    Calendar: {
        allDay: 'Siku Nzima',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} zaidi',
    },
    Upload: {
        mainText: 'Bofya ili Upakie Faili au Buruta Faili hapa',
        illegalTips: 'Aina hii ya faili haitumiki',
        legalTips: 'Achilia na uanze kupakia',
        retry: 'Jaribu tena',
        replace: 'Badilisha Faili',
        clear: 'Futa',
        selectedFiles: 'Faili Ulizochagua',
        illegalSize: 'Ukubwa wa faili si sahihi',
        fail: 'Pakia faili',
    },
    TreeSelect: {
        searchPlaceholder: 'Tafuta',
    },
    Typography: {
        copy: 'Nakili',
        copied: 'Umenakili',
        expand: 'Panua',
        collapse: 'Kunja',
    },
    Transfer: {
        emptyLeft: 'Hakuna Data',
        emptySearch: 'Hakuna matokeo ya utafutaji',
        emptyRight: 'Hakuna maudhui, angalia kutoka kushoto',
        placeholder: 'Tafuta',
        clear: 'Futa',
        selectAll: 'Chagua zote',
        clearSelectAll: 'Acha kuchagua zote',
        total: 'Jumla ya vipengee: ${total}',
        selected: 'Vipengee ulivyochagua: ${total}',
    },
    Form: {
        optional: '(si lazima)',
    },
    Image: {
        preview: 'Hakiki',
        loading: 'Inapakia',
        loadError: 'Imeshindwa kupakia',
        prevTip: 'Iliyotangulia',
        nextTip: 'Endelea',
        zoomInTip: 'Vuta karibu',
        zoomOutTip: 'Songeza mbali',
        rotateTip: 'Zungusha',
        downloadTip: 'Pakua',
        adaptiveTip: 'Fanya itoshee kwenye ukurasa',
        originTip: 'Ukubwa asilia',
    },
    Chat: {
        deleteConfirm: 'Una uhakika kuwa ungependa kufuta kipindi hiki?',
        clearContext: 'Umefuta muktadha',
        copySuccess: 'Umenakili.',
        stop: 'Sitisha',
        copy: 'Nakili',
        copied: 'Umenakili',
        dropAreaText: 'Weka faili hapa',
    },
    UserGuide: {
        skip: 'Ruka',
        next: 'Endelea',
        prev: 'Iliyotangulia',
        finish: 'Maliza',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Tafuta',
        replace: 'Badilisha',
        replaceAll: 'Badilisha Zote',
    },
    VideoPlayer: {
        rateChange: 'Badilisha kiwango kiwe ${rate}',
        qualityChange: 'Badilisha ubora uwe ${quality}',
        routeChange: 'Badilisha njia iwe ${route}',
        mirror: 'Akisi',
        cancelMirror: 'Acha kuakisi',
        loading: 'Inapakia...',
        stall: 'Imeshindwa kupakia',
        noResource: 'Hakuna nyenzo',
        videoError: 'Hitilafu katika kupakia video',
    },
    AIChatDialogue: {
        delete: 'Futa',
        deleteConfirm: 'Una uhakika kuwa ungependa kufuta ujumbe huu?',
        deleteContent: 'Ujumbe huu utafutwa kabisa na hutaweza kuurejesha.',
        copySuccess: 'Umenakili',
        loading: 'Inapakia...',
        reasoning: {
            completed: 'Imemaliza kuandaa',
            thinking: 'Inaandaa...'
        },
        annotationText: 'taarifa'
    },
    Feedback: {
        submit: 'Tuma',
        cancel: 'Ghairi'
    },
    AIChatInput: {
        template: 'Kiolezo',
        configure: 'Weka mipangilio',
        selected: 'Umechagua vipengee ${count}',
    }
};

export default local;