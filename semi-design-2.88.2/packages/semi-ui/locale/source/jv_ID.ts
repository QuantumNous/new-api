import { id } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'jv-ID',
    dateFnsLocale: id,
    currency: 'IDR',
    Pagination: {
        pageSize: 'Item saben kaca: ${pageSize}',
        total: 'Total kaca: ${total}',
        jumpTo: 'Mlumpat menyang',
        page: ' kaca',
    },
    Modal: {
        confirm: 'Konfirmasi',
        cancel: 'Wurungake',
    },
    Tabs: {
        more: "Liyane"
    },
    TimePicker: {
        placeholder: {
            time: 'Pilih wektu',
            timeRange: 'Pilih rentang wektu',
        },
        begin: 'Wektu Wiwitan',
        end: 'Wektu Pungkasan',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'Pilih tanggal',
            dateTime: 'Pilih tanggal lan wektu',
            dateRange: ['Tanggal wiwitan', 'Tanggal pungkasan'],
            dateTimeRange: ['Tanggal wiwitan', 'Tanggal pungkasan'],
            monthRange: ['Sasi wiwitan', 'Sasi pungkasan'],
        },
        presets: 'Prasetel',
        footer: {
            confirm: 'Konfirmasi',
            cancel: 'Wurungake',
        },
        selectDate: 'Pilih Tanggal',
        selectTime: 'Pilih Wektu',
        year: 'taun',
        month: 'sasi',
        day: 'dina',
        monthText: '${month} ${year}',
        months: {
            1: 'Jan',
            2: 'Feb',
            3: 'Mar',
            4: 'Apr',
            5: 'Mei',
            6: 'Jun',
            7: 'Jul',
            8: 'Agu',
            9: 'Sep',
            10: 'Okt',
            11: 'Nov',
            12: 'Des',
        },
        fullMonths: {
            1: 'Januari',
            2: 'Februari',
            3: 'Maret',
            4: 'April',
            5: 'Mei',
            6: 'Juni',
            7: 'Juli',
            8: 'Agustus',
            9: 'September',
            10: 'Oktober',
            11: 'November',
            12: 'Desember',
        },
        weeks: {
            Mon: 'Sen',
            Tue: 'Sel',
            Wed: 'Reb',
            Thu: 'Kem',
            Fri: 'Jem',
            Sat: 'Set',
            Sun: 'Ming',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'DD/mm/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Konfirmasi',
        cancel: 'Wurungake',
    },
    Navigation: {
        collapseText: 'Ciyutake Wilah Sisih',
        expandText: 'Ambakake Wilah Sisih',
    },
    Table: {
        emptyText: 'Ora Ana Asil',
        pageText: 'Nuduhake ${currentStart} nganti ${currentEnd} saka ${total}',
        descend: 'Klik kanggo mudhun',
        ascend: 'Klik kanggo munggah',
        cancelSort: 'Wurungake anggone ngurutake',
    },
    Select: {
        emptyText: 'Ora Ana Asil',
        createText: 'Gawe',
    },
    Cascader: {
        emptyText: 'Ora Ana Asil',
    },
    Tree: {
        emptyText: 'Ora Ana Asil',
        searchPlaceholder: 'Tlusuri',
    },
    List: {
        emptyText: 'Ora Ana Asil',
    },
    Calendar: {
        allDay: 'Sedina Muput',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} liyane',
    },
    Upload: {
        mainText: 'Klik kanggo Ngunggah FIle utawa Gered File ing kene',
        illegalTips: 'Jinis file iki ora didhukung',
        legalTips: 'Rilis lan wiwit ngunggah',
        retry: 'Coba maneh',
        replace: 'Ganti File',
        clear: 'Resiki',
        selectedFiles: 'File Sing Dipilih',
        illegalSize: 'Ukuran file ilegal',
        fail: 'Unggahan gagal',
    },
    TreeSelect: {
        searchPlaceholder: 'Tlusuri',
    },
    Typography: {
        copy: 'Salin',
        copied: 'Disalin',
        expand: 'Ambakake',
        collapse: 'Ciyutake',
    },
    Transfer: {
        emptyLeft: 'Ora Ana Data',
        emptySearch: 'Ora ana asil tlusuran',
        emptyRight: 'Ora ana konten, priksa saka kiwa',
        placeholder: 'Tlusuri',
        clear: 'Resiki',
        selectAll: 'Pilih kabeh',
        clearSelectAll: 'Wurung milih kabeh',
        total: 'Total item: ${total}',
        selected: 'Item sing dipilih: ${total}',
    },
    Form: {
        optional: '(opsional)',
    },
    Image: {
        preview: 'Pratinjo',
        loading: 'Ngamot',
        loadError: 'Gagal ngamot',
        prevTip: 'Sadurunge',
        nextTip: 'Sabanjure',
        zoomInTip: 'Cedhakake',
        zoomOutTip: 'Adohake',
        rotateTip: 'Puter',
        downloadTip: 'Undhuh',
        adaptiveTip: 'Adaptasi menyang kaca',
        originTip: 'Ukuran asli',
    },
    Chat: {
        deleteConfirm: 'Apa sampeyan yakin pengin mbusak sesi iki?',
        clearContext: 'Konteks wis diresiki',
        copySuccess: 'Salin kasil.',
        stop: 'Mandheg',
        copy: 'Salin',
        copied: 'Disalin',
        dropAreaText: 'Selehake file ing kene',
    },
    UserGuide: {
        skip: 'Lumpati',
        next: 'Sabanjure',
        prev: 'Sadurunge',
        finish: 'Rampung',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Tlusuri',
        replace: 'Ganti',
        replaceAll: 'Ganti Kabeh',
    },
    VideoPlayer: {
        rateChange: 'Alihake tingkat dadi ${rate}',
        qualityChange: 'Alihake kualitas dadi ${quality}',
        routeChange: 'Alihake rute dadi ${route}',
        mirror: 'Pengilon',
        cancelMirror: 'Wurungake pengilon',
        loading: 'Ngamot...',
        stall: 'Gagal ngamot',
        noResource: 'Ora ana sumber daya',
        videoError: 'Error ngamot video',
    },
    AIChatDialogue: {
        delete: 'Busak',
        deleteConfirm: 'Apa sampeyan yakin kepengin mbusak pesen iki?',
        deleteContent: 'Pesen iki bakal dibusak salawase lan ora bisa dipulihake.',
        copySuccess: 'Salin kasil',
        loading: 'Ngamot...',
        reasoning: {
            completed: 'Panalaran rampung',
            thinking: 'Mikir...'
        },
        annotationText: 'cuplikan informasi'
    },
    Feedback: {
        submit: 'Kirim',
        cancel: 'Wurungake'
    },
    AIChatInput: {
        template: 'Templat',
        configure: 'Konfigurasi',
        selected: 'Item ${count} sing dipilih',
    }
};

export default local;