import { az } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'az',
    dateFnsLocale: az,
    currency: 'AZN',
    Pagination: {
        pageSize: 'Hər səhifədə elementlər: ${pageSize}',
        total: 'Səhifələrin ümumi sayı: ${total}',
        jumpTo: 'Keçid et',
        page: ' səhifə',
    },
    Modal: {
        confirm: 'Təsdiq et',
        cancel: 'Ləğv et',
    },
    Tabs: {
        more: "Daha çox"
    },
    TimePicker: {
        placeholder: {
            time: 'Vaxt seçin',
            timeRange: 'Vaxt intervalı seçin',
        },
        begin: 'Başlama vaxtı',
        end: 'Bitmə vaxtı',
        hour: '',
        minute: '',
        second: '',
        AM: 'Səhər',
        PM: 'Günortadan sonra',
    },
    DatePicker: {
        placeholder: {
            date: 'Tarix seçin',
            dateTime: 'Tarix və vaxt seçin',
            dateRange: ['Başlama tarixi', 'Bitmə tarixi'],
            dateTimeRange: ['Başlama tarixi', 'Bitmə tarixi'],
            monthRange: ['Başlama ayı', 'Bitmə ayı'],
        },
        presets: 'Hazır tənzimləmələr',
        footer: {
            confirm: 'Təsdiq et',
            cancel: 'Ləğv et',
        },
        selectDate: 'Tarix seçin',
        selectTime: 'Vaxt seçin',
        year: 'il',
        month: 'ay',
        day: 'gün',
        monthText: '${month} ${year}',
        months: {
            1: 'Yan',
            2: 'Fev',
            3: 'Mar',
            4: 'Apr',
            5: 'may',
            6: 'İyn',
            7: 'İyl',
            8: 'Avq',
            9: 'Sen',
            10: 'Okt',
            11: 'Noy',
            12: 'Dek',
        },
        fullMonths: {
            1: 'yanvar',
            2: 'fevral',
            3: 'mart',
            4: 'aprel',
            5: 'may',
            6: 'iyun',
            7: 'iyul',
            8: 'avqust',
            9: 'sentyabr',
            10: 'oktyabr',
            11: 'noyabr',
            12: 'dekabr',
        },
        weeks: {
            Mon: 'B.e.',
            Tue: 'Ç.a.',
            Wed: 'Ç.',
            Thu: 'C.a.',
            Fri: 'C.',
            Sat: 'Ş.',
            Sun: 'B.',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd.MM.yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Təsdiq et',
        cancel: 'Ləğv et',
    },
    Navigation: {
        collapseText: 'Yan paneli yığışdır',
        expandText: 'Yan paneli genişləndir',
    },
    Table: {
        emptyText: 'Nəticə yoxdur',
        pageText: '${total}-dan ${currentStart} - ${currentEnd} göstərilir',
        descend: 'Azalan şəkildə etmək üçün klikləyin',
        ascend: 'Artan şəkildə etmək üçün klikləyin',
        cancelSort: 'Çeşidləməni ləğv edin',
    },
    Select: {
        emptyText: 'Nəticə yoxdur',
        createText: 'Yarat',
    },
    Cascader: {
        emptyText: 'Nəticə yoxdur',
    },
    Tree: {
        emptyText: 'Nəticə yoxdur',
        searchPlaceholder: 'Axtarış',
    },
    List: {
        emptyText: 'Nəticə yoxdur',
    },
    Calendar: {
        allDay: 'Bütün gün',
        AM: 'Səhər ${time}',
        PM: 'Günortadan sonra ${time}',
        datestring: '',
        remaining: '${remained} daha',
    },
    Upload: {
        mainText: 'Faylı yükləmək və ya faylı bura sürükləmək üçün klikləyin',
        illegalTips: 'Bu fayl növü dəstəklənmir',
        legalTips: 'Buraxın və yükləməyə başlayın',
        retry: 'Təkrar cəhd et',
        replace: 'Faylı əvəzlə',
        clear: 'Təmizlə',
        selectedFiles: 'Seçilmiş fayllar',
        illegalSize: 'Qanunsuz fayl ölçüsü',
        fail: 'Yüklənmədi',
    },
    TreeSelect: {
        searchPlaceholder: 'Axtarış',
    },
    Typography: {
        copy: 'Kopiyala',
        copied: 'Kopiyalandı',
        expand: 'Genişləndir',
        collapse: 'Yığcamlaşdır',
    },
    Transfer: {
        emptyLeft: 'Məlumat yoxdur',
        emptySearch: 'Axtarış nəticəsi yoxdur',
        emptyRight: 'Kontent yoxdur, soldan yoxlayın',
        placeholder: 'Axtarış',
        clear: 'Təmizlə',
        selectAll: 'Hamısını seçin',
        clearSelectAll: 'Hamısının seçimini ləğv edin',
        total: 'Elementlərin ümumi sayı: ${total}',
        selected: 'Seçilmiş elementlər: ${total}',
    },
    Form: {
        optional: '(könüllü)',
    },
    Image: {
        preview: 'Önizləmə',
        loading: 'Yüklənir',
        loadError: 'Yükləmək alınmadı',
        prevTip: 'Əvvəlki',
        nextTip: 'Növbəti',
        zoomInTip: 'Böyüt',
        zoomOutTip: 'Kiçilt',
        rotateTip: 'Fırlat',
        downloadTip: 'Endir',
        adaptiveTip: 'Səhifəyə uyğunlaşdır',
        originTip: 'Orijinal ölçü',
    },
    Chat: {
        deleteConfirm: 'Bu seansı silmək istədiyinizdən əminsiniz?',
        clearContext: 'Kontekst təmizləndi',
        copySuccess: 'Uğurla kopiyalandı.',
        stop: 'Dayandır',
        copy: 'Kopiyala',
        copied: 'Kopiyalandı',
        dropAreaText: 'Faylı bura qoyun',
    },
    UserGuide: {
        skip: 'Ötür',
        next: 'Növbəti',
        prev: 'Əvvəlki',
        finish: 'Bitir',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Axtarış',
        replace: 'Əvəz et',
        replaceAll: 'Hamısını əvəz et',
    },
    VideoPlayer: {
        rateChange: 'Sürəti ${rate} olaraq dəyişin',
        qualityChange: 'Keyfiyyəti ${quality} olaraq dəyişin',
        routeChange: 'Marşrutu ${route} olaraq dəyişin',
        mirror: 'Əksetmə',
        cancelMirror: 'Əksetməni ləğv et',
        loading: 'Yüklənir...',
        stall: 'Yüklənmədi',
        noResource: 'Resurs yoxdur',
        videoError: 'Video yükləməsi xətası',
    },
    AIChatDialogue: {
        delete: 'Silin',
        deleteConfirm: 'Bu mesajı silmək istədiyinizdən əminsiniz?',
        deleteContent: 'Bu mesaj həmişəlik silinəcək və onu bərpa etmək mümkün olmayacaq.',
        copySuccess: 'Uğurla kopiyalandı',
        loading: 'Yüklənir...',
        reasoning: {
            completed: 'Məntiq yürütmə tamamlandı',
            thinking: 'Düşünür...'
        },
        annotationText: 'məlumat mənbəsi'
    },
    Feedback: {
        submit: 'Təqdim edin',
        cancel: 'Ləğv edin'
    },
    AIChatInput: {
        template: 'Şablon',
        configure: 'Konfiqurasiya',
        selected: 'Seçilmiş ${count} element',
    }
};

// [i18n-Azerbaijani]
export default local;