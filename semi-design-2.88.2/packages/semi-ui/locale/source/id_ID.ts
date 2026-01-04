import { id } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'id-ID',
    dateFnsLocale: id,
    currency: 'IDR',
    Pagination: {
        pageSize: 'Item per halaman: ${pageSize}',
        total: 'Total halaman: ${total}',
        jumpTo: 'Langsung ke',
        page: ' halaman',
    },
    Modal: {
        confirm: 'Konfirmasi',
        cancel: 'Batalkan',
    },
    Tabs: {
        more: "Lagi"
    },
    TimePicker: {
        placeholder: {
            time: 'Pilih waktu',
            timeRange: 'Pilih jangkauan waktu',
        },
        begin: 'Waktu Mula',
        end: 'Waktu Akhir',
        hour: '',
        minute: '',
        second: '',
        AM: 'pagi',
        PM: 'sore',
    },
    DatePicker: {
        placeholder: {
            date: 'Pilih tanggal',
            dateTime: 'Pilih tanggal dan waktu',
            dateRange: ['Tanggal mulai', 'Tanggal akhir'],
            dateTimeRange: ['Tanggal mulai', 'Tanggal akhir'],
            monthRange: ['Bulan pertama', 'Bulan terakhir'],
        },
        presets: 'Pilihan cepat',
        footer: {
            confirm: 'Konfirmasi',
            cancel: 'Batalkan',
        },
        selectDate: 'Pilih Tarikh',
        selectTime: 'Pilih Waktu',
        year: 'tahun',
        month: 'bulan',
        day: 'hari',
        monthText: '${month} ${year}',
        months: {
            1: 'Jan',
            2: 'Feb',
            3: 'Mar',
            4: 'Apr',
            5: 'Mei',
            6: 'Jun',
            7: 'Jul',
            8: 'Ags',
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
            Wed: 'Rab',
            Thu: 'Kam',
            Fri: 'Jum',
            Sat: 'Sab',
            Sun: 'Min',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/MM/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Konfirmasi',
        cancel: 'Batalkan',
    },
    Navigation: {
        collapseText: 'Kolapse Sidebar',
        expandText: 'Tambah Bar Sisi',
    },
    Table: {
        emptyText: 'Tidak ada Hasil',
        pageText: 'Menampilkan ${currentStart}-${currentEnd} dari ${total}',
        descend: 'Klik untuk menurun',
        ascend: 'Klik untuk menaik',
        cancelSort: 'Batalkan penyortiran',
    },
    Select: {
        emptyText: 'Tidak ada Hasil',
        createText: 'Buat',
    },
    Cascader: {
        emptyText: 'Tidak ada Hasil',
    },
    Tree: {
        emptyText: 'Tidak ada Hasil',
        searchPlaceholder: 'Cari',
    },
    List: {
        emptyText: 'Tidak ada Hasil',
    },
    Calendar: {
        allDay: 'Sepanjang Hari',
        AM: '${time} pagi',
        PM: '${time} sore',
        datestring: '',
        remaining: '${remained} lebih',
    },
    Upload: {
        mainText: 'Klik untuk mengunggah Berkas atau Tarik Berkas ke sini',
        illegalTips: 'Jenis berkas ini tidak didukung',
        legalTips: 'Lepaskan dan mulai mengunggah',
        retry: 'Coba ulang',
        replace: 'Ganti file',
        clear: 'Bersihkan',
        selectedFiles: 'Berkas Dipilih',
        illegalSize: 'Ukuran berkas tidak sah',
        fail: 'Pemuat naik gagal',
    },
    TreeSelect: {
        searchPlaceholder: 'Cari',
    },
    Typography: {
        copy: 'Salin',
        copied: 'Disalin',
        expand: 'Kembangkan',
        collapse: 'Kolapse',
    },
    Transfer: {
        emptyLeft: 'Tidak ada Data',
        emptySearch: 'Tidak ada hasil pencarian',
        emptyRight: 'Tidak ada isi, periksa dari kiri',
        placeholder: 'Cari',
        clear: 'Bersihkan',
        selectAll: 'Pilih Semua',
        clearSelectAll: 'Nyahpilih Semua',
        total: 'Total item: ${total}',
        selected: 'Item dipilih: ${total}',
    },
    Form: {
        optional: '(opsional)',
    },
    Image: {
        preview: 'Pratinjau',
        loading: 'Memuat',
        loadError: 'Gagal untuk memuat',
        prevTip: 'Sebelumnya',
        nextTip: 'Selanjutnya',
        zoomInTip: 'Memperbesar',
        zoomOutTip: 'memperkecil',
        rotateTip: 'Putar',
        downloadTip: 'unduh',
        adaptiveTip: 'Beradaptasi dengan halaman',
        originTip: 'Ukuran asli',
    },
    Chat: {
        deleteConfirm: 'Apakah Anda yakin ingin menghapus sesi ini?？',
        clearContext: 'Konteks telah dihapus',
        copySuccess: 'Berhasil disalin',
        stop: 'Berhenti',
        copy: 'Salin',
        copied: 'Disalin',
        dropAreaText: 'Letakkan file di sini',
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
        noResource: 'Tidak ada sumber',
        videoError: 'Kesalahan memuat video'
    },
    AIChatDialogue: {
        delete: 'Hapus',
        deleteConfirm: 'Apakah Anda yakin ingin menghapus pesan ini?',
        deleteContent: 'Pesan ini akan dihapus secara permanen dan tidak dapat dipulihkan.',
        copySuccess: 'Berhasil disalin',
        loading: 'Memuat...',
        reasoning: {
            completed: 'Pemrosesan selesai',
            thinking: 'Memroses...'
        },
        annotationText: 'elemen informasi'
    },
    Feedback: {
        submit: 'Kirim',
        cancel: 'Batal'
    },
    AIChatInput: {
        template: 'Templat',
        configure: 'Konfigurasikan',
        selected: 'Item yang dipilih ${count}',
    }
};

// [i18n-Indonesia(ID)]
export default local;

