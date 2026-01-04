import { kk } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'kk',
    dateFnsLocale: kk,
    currency: 'KZT',
    Pagination: {
        pageSize: 'Әр беттегі элементтер саны: ${pageSize}',
        total: 'Жалпы беттер саны: ${total}',
        jumpTo: 'Келесіге өту:',
        page: ' бет',
    },
    Modal: {
        confirm: 'Растау',
        cancel: 'Бас тарту',
    },
    Tabs: {
        more: "Тағы"
    },
    TimePicker: {
        placeholder: {
            time: 'Уақытты таңдаңыз',
            timeRange: 'Уақыт ауқымын таңдаңыз',
        },
        begin: 'Басталу уақыты',
        end: 'Аяқталу уақыты',
        hour: '',
        minute: '',
        second: '',
        AM: 'Түске дейін',
        PM: 'Түстен кейін',
    },
    DatePicker: {
        placeholder: {
            date: 'Күнді таңдаңыз',
            dateTime: 'Күн мен уақытты таңдаңыз',
            dateRange: ['Басталу күні', 'Аяқталу күні'],
            dateTimeRange: ['Басталу күні', 'Аяқталу күні'],
            monthRange: ['Басталу айы', 'Аяқталу айы'],
        },
        presets: 'Алдын ала орнатылған параметрлер',
        footer: {
            confirm: 'Растау',
            cancel: 'Бас тарту',
        },
        selectDate: 'Күнді таңдаңыз',
        selectTime: 'Уақытты таңдаңыз',
        year: 'жыл',
        month: 'ай',
        day: 'күн',
        monthText: '${month} ${year}',
        months: {
            1: 'Қаң',
            2: 'Ақп',
            3: 'Нау',
            4: 'Сәу',
            5: 'Мамыр',
            6: 'Мау',
            7: 'Шіл',
            8: 'Там',
            9: 'Қыр',
            10: 'Қаз',
            11: 'Қар',
            12: 'Жел',
        },
        fullMonths: {
            1: 'Қаңтар',
            2: 'Ақпан',
            3: 'Наурыз',
            4: 'Сәуір',
            5: 'Мамыр',
            6: 'Маусым',
            7: 'Шілде',
            8: 'Тамыз',
            9: 'Қыркүйек',
            10: 'Қазан',
            11: 'Қараша',
            12: 'Желтоқсан',
        },
        weeks: {
            Mon: 'Дүй',
            Tue: 'Сей',
            Wed: 'Сәр',
            Thu: 'Бей',
            Fri: 'Жұм',
            Sat: 'Сен',
            Sun: 'Жек',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'кк/аа/жжжж',
        },
    },
    Popconfirm: {
        confirm: 'Растау',
        cancel: 'Бас тарту',
    },
    Navigation: {
        collapseText: 'Бүйірлік панельді тасалау',
        expandText: 'Бүйірлік панельді жаю',
    },
    Table: {
        emptyText: 'Нәтиже жоқ',
        pageText: '${total} ішінен ${currentStart}–${currentEnd} көрсетілген',
        descend: 'Кему реті бойынша сұрыптау үшін басыңыз',
        ascend: 'Өсу реті бойынша сұрыптау үшін басыңыз',
        cancelSort: 'Сұрыптаудан бас тарту',
    },
    Select: {
        emptyText: 'Нәтиже жоқ',
        createText: 'Жасау',
    },
    Cascader: {
        emptyText: 'Нәтиже жоқ',
    },
    Tree: {
        emptyText: 'Нәтиже жоқ',
        searchPlaceholder: 'Іздеу',
    },
    List: {
        emptyText: 'Нәтиже жоқ',
    },
    Calendar: {
        allDay: 'Бүкіл күн',
        AM: '${time} (түске дейін)',
        PM: '${time} (түстен кейін)',
        datestring: '',
        remaining: 'Тағы ${remained}',
    },
    Upload: {
        mainText: 'Файлды жүктеп салу үшін басыңыз немесе осы жерге жылжытыңыз',
        illegalTips: 'Бұл файл түріне қолдау көрсетілмейді',
        legalTips: 'Файлды жіберіңіз, сонда жүктеп салу басталады',
        retry: 'Қайталау',
        replace: 'Файлды ауыстыру',
        clear: 'Тазалау',
        selectedFiles: 'Таңдалған файлдар',
        illegalSize: 'Файл өлшемі жарамсыз',
        fail: 'Жүктеп салу сәтсіз аяқталды',
    },
    TreeSelect: {
        searchPlaceholder: 'Іздеу',
    },
    Typography: {
        copy: 'Көшіру',
        copied: 'Көшірілді',
        expand: 'Жаю',
        collapse: 'Тасалау',
    },
    Transfer: {
        emptyLeft: 'Деректер жоқ',
        emptySearch: 'Іздеу нәтижелері жоқ',
        emptyRight: 'Контент жоқ. Сол жақтағы бағанды қараңыз',
        placeholder: 'Іздеу',
        clear: 'Тазалау',
        selectAll: 'Барлығын таңдау',
        clearSelectAll: 'Барлығынан таңдауды алу',
        total: 'Жалпы элементтер саны: ${total}',
        selected: 'Таңдалған элементтер саны: ${total}',
    },
    Form: {
        optional: '(міндетті)',
    },
    Image: {
        preview: 'Алдын ала көру',
        loading: 'Жүктелуде',
        loadError: 'Жүктелмеді',
        prevTip: 'Алдыңғы',
        nextTip: 'Келесі',
        zoomInTip: 'Ұлғайту',
        zoomOutTip: 'Кішірейту',
        rotateTip: 'Бұру',
        downloadTip: 'Жүктеп алу',
        adaptiveTip: 'Бетке сай бейімдеу',
        originTip: 'Бастапқы өлшем',
    },
    Chat: {
        deleteConfirm: 'Осы сеансты жою керектігіне сенімдісіз бе?',
        clearContext: 'Контекст тазаланды',
        copySuccess: 'Сәтті түрде көшірілді.',
        stop: 'Тоқтату',
        copy: 'Көшіру',
        copied: 'Көшірілді',
        dropAreaText: 'Файлды осы жерге қойыңыз',
    },
    UserGuide: {
        skip: 'Өткізіп жіберу',
        next: 'Келесі',
        prev: 'Алдыңғы',
        finish: 'Аяқтау',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Іздеу',
        replace: 'Ауыстыру',
        replaceAll: 'Барлығын ауыстыру',
    },
    VideoPlayer: {
        rateChange: '${rate} жылдамдыққа ауысу',
        qualityChange: '${quality} сапасына ауысу',
        routeChange: '${route} бағдарына ауысу',
        mirror: 'Кері аудару',
        cancelMirror: 'Кері аударудан бас тарту',
        loading: 'Жүктелуде...',
        stall: 'Жүктеу сәтсіз аяқталды',
        noResource: 'Ресурс жоқ',
        videoError: 'Бейнені жүктеу қатесі',
    },
    AIChatDialogue: {
        delete: 'Жою',
        deleteConfirm: 'Бұл хабарламаны жою керектігіне сенімдісіз бе?',
        deleteContent: 'Бұл хабарлама біржолата жойылып, оны қалпына келтіру мүмкін болмайды.',
        copySuccess: 'Сәтті көшірілді',
        loading: 'Жүктелуде...',
        reasoning: {
            completed: 'Негіздеу аяқталды',
            thinking: 'Ойлануда...'
        },
        annotationText: 'құжат'
    },
    Feedback: {
        submit: 'Жіберу',
        cancel: 'Бас тарту'
    },
    AIChatInput: {
        template: 'Үлгі',
        configure: 'Теңшеу',
        selected: '${count} элемент таңдалды',
    }
};

export default local;