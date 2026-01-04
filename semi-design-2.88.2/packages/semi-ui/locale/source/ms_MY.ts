import { ms } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'ms-MY',
    dateFnsLocale: ms,
    currency: 'MYR',
    Pagination: {
        pageSize: 'Item setiap halaman: ${pageSize}',
        total: 'Jumlah halaman: ${total}',
        jumpTo: 'Lompat ke',
        page: ' halaman',
    },
    Modal: {
        confirm: 'Sahkan',
        cancel: 'Batal',
    },
    Tabs: {
        more: "Lagi"
    },
    TimePicker: {
        placeholder: {
            time: 'Pilih masa',
            timeRange: 'Pilih julat masa',
        },
        begin: 'Masa Mula',
        end: 'Masa Akhir',
        hour: '',
        minute: '',
        second: '',
        AM: 'pagi',
        PM: 'petang',
    },
    DatePicker: {
        placeholder: {
            date: 'Pilih tarikh',
            dateTime: 'Pilih tarikh dan masa',
            dateRange: ['Tarikh mula', 'Tarikh akhir'],
            dateTimeRange: ['Tarikh mula', 'Tarikh akhir'],
            monthRange: ['Bulan mula', 'Bulan akhir'],
        },
        presets: 'Pilihan Pantas',
        footer: {
            confirm: 'Sahkan',
            cancel: 'Batal',
        },
        selectDate: 'Pilih Tarikh',
        selectTime: 'Pilih Masa',
        year: 'tahun',
        month: 'bulan',
        day: 'hari',
        monthText: '${month} ${year}',
        months: {
            1: 'Januari',
            2: 'Februari',
            3: 'Mac',
            4: 'April',
            5: 'Mei',
            6: 'Jun',
            7: 'Julai',
            8: 'Ogos',
            9: 'September',
            10: 'Oktober',
            11: 'November',
            12: 'Disember',
        },
        fullMonths: {
            1: 'Januari',
            2: 'Februari',
            3: 'Mac',
            4: 'April',
            5: 'Mei',
            6: 'Jun',
            7: 'Julai',
            8: 'Ogos',
            9: 'September',
            10: 'Oktober',
            11: 'November',
            12: 'Disember',
        },
        weeks: {
            Mon: 'Isn',
            Tue: 'Sel',
            Wed: 'Rab',
            Thu: 'Kha',
            Fri: 'Jum',
            Sat: 'Sab',
            Sun: 'Aha',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/MM/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Sahkan',
        cancel: 'Batal',
    },
    Navigation: {
        collapseText: 'Kolapse Sidebar',
        expandText: 'Kembangkan bar sisi',
    },
    Table: {
        emptyText: 'Tiada kandungan',
        pageText: 'Papar halaman ${currentStart} hingga ${currentEnd} daripada ${total}',
        descend: 'Klik untuk menurun',
        ascend: 'Klik untuk menaik',
        cancelSort: 'Batal mengurutkan',
    },
    Select: {
        emptyText: 'Tiada kandungan',
        createText: 'Tetapkan',
    },
    Cascader: {
        emptyText: 'Tiada kandungan',
    },
    Tree: {
        emptyText: 'Tiada kandungan',
        searchPlaceholder: 'Cari',
    },
    List: {
        emptyText: 'Tiada kandungan',
    },
    Calendar: {
        allDay: 'Sepanjang Hari',
        AM: '${time} pagi',
        PM: '${time} petang',
        datestring: '',
        remaining: '${remained} lebih',
    },
    Upload: {
        mainText: 'Klik untuk Muat Naik Fail atau Seret Fail ke sini',
        illegalTips: 'Jenis fail ini tidak disokong',
        legalTips: 'Lepaskan dan mula muat naik',
        retry: 'Cuba Semula',
        replace: 'Ganti fail',
        clear: 'Kosongkan',
        selectedFiles: 'Fail Dipilih',
        illegalSize: 'Saiz fail tidak sah',
        fail: 'Muat naik gagal',
    },
    TreeSelect: {
        searchPlaceholder: 'Cari',
    },
    Typography: {
        copy: 'Samin',
        copied: 'Disalin',
        expand: 'Buka',
        collapse: 'Collapse',
    },
    Transfer: {
        emptyLeft: 'Tiada Data',
        emptySearch: 'Tiada hasil gelintar',
        emptyRight: 'Tiada kandungan, periksa dari kiri',
        placeholder: 'Cari',
        clear: 'Kosongkan',
        selectAll: 'Pilih Semua',
        clearSelectAll: 'Nyahpilih semua',
        total: 'Jumlah item: ${total}',
        selected: 'Item dipilih: ${total}',
    },
    Form: {
        optional: '(pilihan)',
    },
    Image: {
        preview: 'Pratonton',
        loading: 'Memuatkan',
        loadError: 'Gagal memuatkan',
        prevTip: 'Sebelumnya',
        nextTip: 'Seterusnya',
        zoomInTip: 'Zum masuk',
        zoomOutTip: 'zum keluar',
        rotateTip: 'Putar',
        downloadTip: 'muat turun',
        adaptiveTip: 'Menyesuaikan diri dengan halaman',
        originTip: 'Saiz asal',
    },
    Chat: {
        deleteConfirm: 'Adakah anda pasti ingin memadam sesi ini?',
        clearContext: 'Konteks telah dibersihkan',
        copySuccess: 'Berjaya disalin',
        stop: 'Berhenti',
        copy: 'Samin',
        copied: 'Disalin',
        dropAreaText: 'Letakkan fail di sini',
    },
    UserGuide: {
        skip: 'Lewati',
        next: 'Selanjutnya',
        prev: 'Sebelumnya',
        finish: 'Selesai',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Cari',
        replace: 'Ganti',
        replaceAll: 'Ganti Semua',
    },
    VideoPlayer: {
        rateChange: 'Ubah kecepatan ke ${rate}',
        qualityChange: 'Ubah kualitas ke ${quality}',
        routeChange: 'Ubah rute ke ${route}',
        mirror: 'Cermin',
        cancelMirror: 'Hapus cermin',
        loading: 'Memuat...',
        stall: 'Memuat gagal',
        noResource: 'Tiada sumber',
        videoError: 'Ralat memuatkan video'
    },
    AIChatDialogue: {
        delete: 'Padam',
        deleteConfirm: 'Adakah anda pasti ingin memadam sesi ini?',
        deleteContent: 'Sesi ini akan dihapus secara permanen dan tidak dapat dipulihkan.',
        copySuccess: 'Berjaya disalin',
        loading: 'Memuat...',
        reasoning: {
            completed: 'Pemrosesan selesai',
            thinking: 'Memroses...'
        },
        annotationText: 'elemen informasi'
    },
    Feedback: {
        submit: 'Hantar',
        cancel: 'Batal'
    },
    AIChatInput: {
        template: 'Stensil',
        configure: 'Konfigurasi',
        selected: '${count} item dipilih',
    }
};

// [i18n-Malaysia(MY)]
export default local;
