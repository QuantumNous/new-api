import { hi } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'ur',
    dateFnsLocale: hi,
    currency: 'امریکی ڈالر',
    Pagination: {
        pageSize: 'فی صفحہ آئٹمز: ${pageSize}',
        total: 'کل صفحات: ${total}',
        jumpTo: 'جائیں',
        page: ' صفحہ',
    },
    Modal: {
        confirm: 'تصدیق کریں',
        cancel: 'منسوخ کریں',
    },
    Tabs: {
        more: "مزید"
    },
    TimePicker: {
        placeholder: {
            time: 'وقت منتخب کریں',
            timeRange: 'وقت کی ایک حد منتخب کریں',
        },
        begin: 'آغاز کا وقت',
        end: 'اختتامی وقت',
        hour: '',
        minute: '',
        second: '',
        AM: 'صبح',
        PM: 'شام',
    },
    DatePicker: {
        placeholder: {
            date: 'تاریخ منتخب کریں',
            dateTime: 'تاریخ اور وقت منتخب کریں',
            dateRange: ['آغاز کی تاریخ', 'اختتامی تاریخ'],
            dateTimeRange: ['آغاز کی تاریخ', 'اختتامی تاریخ'],
            monthRange: ['آغاز کا مہینہ', 'اختتامی مہینہ'],
        },
        presets: 'پری سیٹس',
        footer: {
            confirm: 'تصدیق کریں',
            cancel: 'منسوخ کریں',
        },
        selectDate: 'تاریخ منتخب کریں',
        selectTime: 'وقت منتخب کریں',
        year: 'سال',
        month: 'مہینہ',
        day: 'دن',
        monthText: '${month} ${year}',
        months: {
            1: 'جنوری',
            2: 'فروری',
            3: 'مارچ',
            4: 'اپریل',
            5: 'مئی',
            6: 'جون',
            7: 'جولائی',
            8: 'اگست',
            9: 'ستمبر',
            10: 'اکتوبر',
            11: 'نومبر',
            12: 'دسمبر',
        },
        fullMonths: {
            1: 'جنوری',
            2: 'فروری',
            3: 'مارچ',
            4: 'اپریل',
            5: 'مئی',
            6: 'جون',
            7: 'جولائی',
            8: 'اگست',
            9: 'ستمبر',
            10: 'اکتوبر',
            11: 'نومبر',
            12: 'دسمبر',
        },
        weeks: {
            Mon: 'سوموار',
            Tue: 'منگل',
            Wed: 'بدھ',
            Thu: 'جمعرات',
            Fri: 'جمعہ',
            Sat: 'ہفتہ',
            Sun: 'اتوار',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'مہینہ/دن/سال',
        },
    },
    Popconfirm: {
        confirm: 'تصدیق کریں',
        cancel: 'منسوخ کریں',
    },
    Navigation: {
        collapseText: 'سائیڈ بار بند کریں',
        expandText: 'سائیڈ بار وسیع کریں',
    },
    Table: {
        emptyText: 'کوئی نتیجہ نہیں',
        pageText: '${total} میں سے ${currentStart} تا $ {currentEnd} دکھا رہے ہیں',
        descend: 'نیچے جانے کے لیے کلک کریں',
        ascend: 'اوپر جانے کے لیے کلک کریں',
        cancelSort: 'ترتیب سازی منسوخ کریں',
    },
    Select: {
        emptyText: 'کوئی نتیجہ نہیں',
        createText: 'تخلیق کریں',
    },
    Cascader: {
        emptyText: 'کوئی نتیجہ نہیں',
    },
    Tree: {
        emptyText: 'کوئی نتیجہ نہیں',
        searchPlaceholder: 'تلاش کریں',
    },
    List: {
        emptyText: 'کوئی نتیجہ نہیں',
    },
    Calendar: {
        allDay: 'تمام دن',
        AM: 'صبح ${time} بجے',
        PM: 'شام ${time} بجے',
        datestring: '',
        remaining: 'مزید ${remained}',
    },
    Upload: {
        mainText: 'فائل اپ لوڈ کرنے یا فائل کو یہاں گھسیٹنے کے لیے کلک کریں',
        illegalTips: 'فائل کی یہ قسم معاونت یافتہ نہیں',
        legalTips: 'ریلیز کریں اور اپ لوڈ کرنا شروع کریں',
        retry: 'دوبارہ کوشش کریں',
        replace: 'فائل تبدیل کریں',
        clear: 'صاف کریں',
        selectedFiles: 'منتخب شدہ فائلز',
        illegalSize: 'فائل کا سائز غیر قانونی ہے',
        fail: 'اپ لوڈ کا عمل ناکام ہو گیا',
    },
    TreeSelect: {
        searchPlaceholder: 'تلاش کریں',
    },
    Typography: {
        copy: 'کاپی کریں',
        copied: 'کاپی ہو گیا',
        expand: 'وسیع کریں',
        collapse: 'بند کریں',
    },
    Transfer: {
        emptyLeft: 'کوئی ڈیٹا نہیں',
        emptySearch: 'تلاش کا کوئی نتیجہ نہیں',
        emptyRight: 'کوئی مواد نہیں، بائیں جانب سے چیک کریں',
        placeholder: 'تلاش کریں',
        clear: 'صاف کریں',
        selectAll: 'تمام منتخب کریں',
        clearSelectAll: 'تمام کو غیر منتخب کریں',
        total: 'کل آئٹمز: ${total}',
        selected: 'منتخب شدہ آئٹمز: ${total}',
    },
    Form: {
        optional: '(اختیاری)',
    },
    Image: {
        preview: 'پیش منظر کریں',
        loading: 'لوڈ کیا جا رہا ہے',
        loadError: 'لوڈ کرنے میں ناکامی',
        prevTip: 'پچھلا',
        nextTip: 'اگلا',
        zoomInTip: 'زوم ان کریں',
        zoomOutTip: 'زوم آؤٹ کریں',
        rotateTip: 'گھمائیں',
        downloadTip: 'ڈاؤن لوڈ کریں',
        adaptiveTip: 'صفحے کے مطابق ایڈجسٹ کریں',
        originTip: 'اصل سائز',
    },
    Chat: {
        deleteConfirm: 'کیا آپ واقعی اس سیشن کو حذف کرنا چاہتے ہیں؟',
        clearContext: 'سیاق و سباق صاف ہو گیا',
        copySuccess: 'کاپی کرنے کا عمل کامیاب ہو گیا۔',
        stop: 'روکیں',
        copy: 'کاپی کریں',
        copied: 'کاپی ہو گیا',
        dropAreaText: 'فائل کو یہاں ڈالیں',
    },
    UserGuide: {
        skip: 'نظر انداز کریں',
        next: 'اگلا',
        prev: 'پچھلا',
        finish: 'مکمل کریں',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'تلاش کریں',
        replace: 'بدلیں',
        replaceAll: 'سب بدلیں',
    },
    VideoPlayer: {
        rateChange: 'ریٹ کو ${rate} پر سوئچ کریں',
        qualityChange: 'معیار کو ${quality} پر سوئچ کریں',
        routeChange: 'راستے کو ${route} پر سوئچ کریں',
        mirror: 'مرر',
        cancelMirror: 'مرر کو منسوخ کریں',
        loading: 'لوڈ کیا جا رہا ہے...',
        stall: 'لوڈنگ میں ناکامی',
        noResource: 'کوئی ذرائع نہیں',
        videoError: 'ویڈیو لوڈ کرنے میں نقص',
    },
    AIChatDialogue: {
        delete: 'حذف کریں',
        deleteConfirm: 'کیا آپ واقعی اس پیغام کو حذف کرنا چاہتے ہیں؟',
        deleteContent: 'یہ پیغام مستقل طور پر حذف کر دیا جائے گا اور اسے بحال نہیں کیا جا سکتا۔',
        copySuccess: 'کاپی کرنے کا عمل کامیابی سے مکمل ہو گیا',
        loading: 'لوڈ کیا جا رہا ہے...',
        reasoning: {
            completed: 'استدلال مکمل ہو گیا',
            thinking: 'سوچ رہے ہیں...'
        },
        annotationText: 'معلومات'
    },
    Feedback: {
        submit: 'جمع کروائیں',
        cancel: 'منسوخ کریں'
    },
    AIChatInput: {
        template: 'ٹیمپلیٹ',
        configure: 'تشکیل کریں',
        selected: '${count} آئٹمز منتخب کی گئیں',
    }
};

export default local;