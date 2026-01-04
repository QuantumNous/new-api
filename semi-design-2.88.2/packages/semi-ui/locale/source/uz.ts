import { uz } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'uz',
    dateFnsLocale: uz,
    currency: 'UZS',
    Pagination: {
        pageSize: 'Bitta sahifadagi elementlar: ${pageSize}',
        total: 'Jami sahifalar: ${total}',
        jumpTo: 'Sakrash',
        page: ' sahifa',
    },
    Modal: {
        confirm: 'Tasdiqlash',
        cancel: 'Bekor qilish',
    },
    Tabs: {
        more: "Yana"
    },
    TimePicker: {
        placeholder: {
            time: 'Vaqtni tanlash',
            timeRange: 'Vaqt oraligʻini tanlang',
        },
        begin: 'Boshlanish vaqti',
        end: 'Tugash vaqti',
        hour: '',
        minute: '',
        second: '',
        AM: 'TO',
        PM: 'TK',
    },
    DatePicker: {
        placeholder: {
            date: 'Sanani tanlang',
            dateTime: 'Sana va vaqtni tanlang',
            dateRange: ['Boshlanish sanasi', 'Tugash sanasi'],
            dateTimeRange: ['Boshlanish sanasi', 'Tugash sanasi'],
            monthRange: ['Dastlabki oy', 'Oy oxiri'],
        },
        presets: 'Anzodalar',
        footer: {
            confirm: 'Tasdiqlash',
            cancel: 'Bekor qilish',
        },
        selectDate: 'Sanani tanlang',
        selectTime: 'Vaqtni tanlash',
        year: 'yil',
        month: 'oy',
        day: 'kun',
        monthText: '${month} ${year}',
        months: {
            1: 'Yan',
            2: 'Fev',
            3: 'Mar',
            4: 'Apr',
            5: 'May',
            6: 'Iyn',
            7: 'Iyl',
            8: 'Avg',
            9: 'Sen',
            10: 'Okt',
            11: 'Noy',
            12: 'Dek',
        },
        fullMonths: {
            1: 'Yanvar',
            2: 'Fevral',
            3: 'Mart',
            4: 'Aprel',
            5: 'May',
            6: 'Iyun',
            7: 'Iyul',
            8: 'Avgust',
            9: 'Sentabr',
            10: 'Oktabr',
            11: 'Noyabr',
            12: 'Dekabr',
        },
        weeks: {
            Mon: 'Dush',
            Tue: 'Sesh',
            Wed: 'Chor',
            Thu: 'Pay',
            Fri: 'Jum',
            Sat: 'Shan',
            Sun: 'Yak',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'OO/kk/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Tasdiqlash',
        cancel: 'Bekor qilish',
    },
    Navigation: {
        collapseText: 'Yon panelni kichraytirish',
        expandText: 'Yon panelni kengaytirish',
    },
    Table: {
        emptyText: 'Natija yoʻq',
        pageText: '${currentStart} dan ${currentEnd} gacha koʻrsatilmoqda, jami ${total}',
        descend: 'Kamayish tartibida koʻrsatish uchun cherting',
        ascend: 'Ortish tartibida koʻrsatish uchun cherting',
        cancelSort: 'Saralashni bekor qilish',
    },
    Select: {
        emptyText: 'Natija yoʻq',
        createText: 'Yaratish',
    },
    Cascader: {
        emptyText: 'Natija yoʻq',
    },
    Tree: {
        emptyText: 'Natija yoʻq',
        searchPlaceholder: 'Qidirish',
    },
    List: {
        emptyText: 'Natija yoʻq',
    },
    Calendar: {
        allDay: 'Kun davomida',
        AM: '${time} TO',
        PM: '${time} TK',
        datestring: '',
        remaining: 'Yana ${remained}',
    },
    Upload: {
        mainText: 'Faylni yuklashga cherting yoki Faylni bu yerga tortib olib keling',
        illegalTips: 'Bu tur qoʻllab-quvvatlanmaydi',
        legalTips: 'Ruxsat bering va yuklashni boshlang',
        retry: 'Qayta urinish',
        replace: 'Faylni almashtiring',
        clear: 'Tozalash',
        selectedFiles: 'Tanlangan fayllar',
        illegalSize: 'Mumkin boʻlmagan fayl hajmi',
        fail: 'Yuklab boʻlmadi',
    },
    TreeSelect: {
        searchPlaceholder: 'Qidirish',
    },
    Typography: {
        copy: 'Nusxa olish',
        copied: 'Nusxa olindi',
        expand: 'Kengaytirish',
        collapse: 'Kichraytirish',
    },
    Transfer: {
        emptyLeft: 'Maʼlumot yoʻq',
        emptySearch: 'Qidiruv natijalari topilmadi',
        emptyRight: 'Kontent yoʻq, chapdan boshlab tekshiring',
        placeholder: 'Qidirish',
        clear: 'Tozalash',
        selectAll: 'Hammasini tanlash',
        clearSelectAll: 'Hammasini bekor qilish',
        total: 'Jami elementlar: ${total}',
        selected: 'Tanlangan elementlar: ${total}',
    },
    Form: {
        optional: '(ixtiyoriy)',
    },
    Image: {
        preview: 'Razm solish',
        loading: 'Yuklanmoqda',
        loadError: 'Yuklanmadi',
        prevTip: 'Avvalgi',
        nextTip: 'Keyingi',
        zoomInTip: 'Kattalashtirish',
        zoomOutTip: 'Kichiklashtirish',
        rotateTip: 'Burish',
        downloadTip: 'Yuklab olish',
        adaptiveTip: 'Sahifaga moslash',
        originTip: 'Asl oʻlchami',
    },
    Chat: {
        deleteConfirm: 'Bu seansni haqiqatan ham oʻchirmoqchimisiz?',
        clearContext: 'Kontekst tozalandi',
        copySuccess: 'Nusxa olindi.',
        stop: 'Toʻxtatish',
        copy: 'Nusxa olish',
        copied: 'Nusxa olindi',
        dropAreaText: 'Faylni bu yerga qoʻying',
    },
    UserGuide: {
        skip: 'Oʻtkazib yuborish',
        next: 'Keyingi',
        prev: 'Avvalgi',
        finish: 'Yakunlash',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Qidirish',
        replace: 'Almashtirish',
        replaceAll: 'Barchasini almashtirish',
    },
    VideoPlayer: {
        rateChange: 'Reytingni ${rate} ga oʻtkazing',
        qualityChange: 'Sifatni ${quality} ga oʻtkazing',
        routeChange: 'Marshrutni ${route} ga oʻtkazing',
        mirror: 'Aks ettirish',
        cancelMirror: 'Aks ettirishni bekor qilish',
        loading: 'Yuklanmoqda...',
        stall: 'Yuklab boʻlmadi',
        noResource: 'Resurs yoʻq',
        videoError: 'Videoni yuklashda xatolik',
    },
    AIChatDialogue: {
        delete: 'Oʻchirish',
        deleteConfirm: 'Bu xabarni haqiqatan ham oʻchirmoqchimisiz?',
        deleteContent: 'Bu xabar butunlay oʻchiriladi va uni tiklab boʻlmaydi?',
        copySuccess: 'Nusxa olindi',
        loading: 'Yuklanmoqda...',
        reasoning: {
            completed: 'Asoslash yakunlandi',
            thinking: 'Oʻylamoqda...'
        },
        annotationText: 'axborot qismlari'
    },
    Feedback: {
        submit: 'Yuborish',
        cancel: 'Bekor qilish'
    },
    AIChatInput: {
        template: 'Andoza',
        configure: 'Sozlash',
        selected: '${count} ta element tanlangan',
    }
};

export default local;