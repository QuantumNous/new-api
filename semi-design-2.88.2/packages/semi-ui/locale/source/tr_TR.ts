import { tr } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'tr-TR',
    dateFnsLocale: tr,
    currency: 'TRY',
    Pagination: {
        page: 'Sayfa',
        pageSize: 'Sayfa başı öğe: ${pageSize}',
        total: 'Toplam sayfa: ${total}',
        jumpTo: 'Atlamak'
    },
    Modal: {
        confirm: 'Tamam',
        cancel: 'İptal'
    },
    Tabs: {
        more: "Daha"
    },
    TimePicker: {
        placeholder: {
            time: 'Lütfen bir zaman seçin',
            timeRange: 'Lütfen bir zaman aralığı seçin'
        },
        begin: 'Başlangıç ​​zamanı',
        end: 'Bitiş zamanı',
        // hour: 'Saat',
        // minute: 'Dakika',
        // second: 'İkinci',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM'
    },
    DatePicker: {
        placeholder: {
            date: 'Lütfen bir tarih seçin',
            dateTime: 'Lütfen bir tarih ve saat seçin',
            dateRange: ['Başlangıç tarihi', 'Bitiş tarihi'],
            dateTimeRange: ['Başlangıç tarihi', 'Bitiş tarihi'],
            monthRange: ['Başlangıç ​​ayı', 'Bitiş ayı']
        },
        presets: 'Hızlı seçim',
        footer: {
            confirm: 'Tamam',
            cancel: 'İptal'
        },
        selectDate: 'Tarih seçmek için geri dönün',
        selectTime: 'saat seçin',
        year: 'yıl',
        month: 'ay',
        day: 'gün',
        monthText: '${year}yıl ${month}',
        months:
        {
            1: 'Ocak',
            2: 'Şubat',
            3: 'Mart',
            4: 'Nisan',
            5: 'Mayıs',
            6: 'Haziran',
            7: 'Temmuz',
            8: 'Ağustos',
            9: 'Eylül',
            10: 'Ekim',
            11: 'Kasım',
            12: 'Aralık',
        },
        fullMonths: {
            1: '1',
            2: '2',
            3: '3',
            4: '4',
            5: '5',
            6: '6',
            7: '7',
            8: '8',
            9: '9',
            10: '10',
            11: '11',
            12: '12'
        },
        weeks: {
            Mon: 'Pzt',
            Tue: 'Salı',
            Wed: 'Çar',
            Thu: 'Perş',
            Fri: 'Cum',
            Sat: 'Cmt',
            Sun: 'Paz'
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd.MM.yyyy',
        },
    },
    Navigation:
    {
        collapseText: 'kenar çubuğunu daralt',
        expandText: 'Kenar çubuğunu genişlet '
    },
    Popconfirm: {
        confirm: 'Tamam',
        cancel: 'İptal'
    },
    Table:
    {
        emptyText: 'Henüz veri yok',
        pageText:
            '${currentStart} öğesini görüntüle - ${currentEnd} öğe, toplam ${total} öğe ',
        descend: 'Azalan sıralama için tıklayın',
        ascend: 'Artan sıralama için tıklayın',
        cancelSort: 'Sıralamayı iptal et',
    
    },
    Select: { emptyText: 'Henüz veri yok', createText: 'Oluştur' },
    Cascader: { emptyText: 'Henüz veri yok' },
    Tree: { emptyText: 'Henüz veri yok', searchPlaceholder: 'Arama ' },
    List: { emptyText: 'Henüz veri yok' },
    Calendar:
    {
        allDay: 'Tüm gün',
        AM: 'Sabah ${time}',
        PM: 'öğleden sonra ${time}',
        datestring: 'gün',
        remaining: '${remained} öğe var'
    },
    Upload:
    {
        mainText:
            'dosyaları yüklemek için tıklayın veya dosyaları buraya sürükleyip bırakın',
        illegalTips: 'bu tür dosyalar desteklenmiyor',
        legalTips: 'bırakın ve yüklemeye başlayın',
        retry: 'Yeniden Dene',
        replace: 'Dosyayı değiştir',
        clear: 'Boş',
        selectedFiles: 'Seçili dosya',
        illegalSize: 'Dosya boyutu geçersiz',
        fail: 'Yükleme başarısız'
    },
    TreeSelect: { searchPlaceholder: 'Arama ' },
    Typography:
    {
        copy: 'Kopyala',
        copied: 'Kopyalama başarılı',
        expand: 'Genişlet',
        collapse: 'Daralt'
    },
    Transfer:
    {
        emptyLeft: 'Henüz veri yok',
        emptySearch: 'Arama sonucu yok',
        emptyRight: 'İçerik yok, soldan kontrol edilemez',
        placeholder: 'Arama',
        clear: 'Boş',
        selectAll: 'Tümünü seç',
        clearSelectAll: 'Tümünün seçimini kaldır',
        total: 'Toplam öğe: ${total}',
        selected: 'Seçilen öğeler: ${total}'
    },
    Form: {
        optional: '(isteğe bağlı)',
    },
    Image: {
        preview: 'Ön izleme',
        loading: 'Yükleniyor',
        loadError: 'Yükleme başarısız',
        prevTip: 'Önceki',
        nextTip: 'Sonraki',
        zoomInTip: 'Yakınlaştır',
        zoomOutTip: 'uzaklaştır',
        rotateTip: 'Döndür',
        downloadTip: 'indir',
        adaptiveTip: 'Sayfaya uyarla',
        originTip: 'Orijinal boyut',
    },
    Chat: {
        deleteConfirm: 'Bu sohbeti silmek istediğinize emin misiniz?',
        clearContext: 'Bağlam temizlendi',
        copySuccess: 'Başarıyla kopyalandı',
        stop: 'Durmak',
        copy: 'Kopyala',
        copied: 'Kopyalama başarılı',
        dropAreaText: 'Dosyayı buraya yerleştirin',
    },
    UserGuide: {
        skip: 'Atla',
        next: 'Sonraki',
        prev: 'Önceki',
        finish: 'Tamamla',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Ara',
        replace: 'Değiştir',
        replaceAll: 'Tümünü değiştir',
    },
    VideoPlayer: {
        rateChange: 'Hızı ${rate}\'e değiştir',
        qualityChange: 'Kaliteyi ${quality}\'e değiştir',
        routeChange: 'Rota ${route}\'e değiştir',
        mirror: 'Ayna',
        cancelMirror: 'Aynayı kaldır',
        loading: 'Yükleniyor...',
        stall: 'Yükleme başarısız',
        noResource: 'Kaynak yok',
        videoError: 'Video yükleme hatası'
    },
    AIChatDialogue: {
        delete: 'Sil',
        deleteConfirm: 'Bu sohbeti silmek istediğinize emin misiniz?',
        deleteContent: 'Bu sohbet silinmiştir.',
        copySuccess: 'Başarıyla kopyalandı',
        loading: 'Yükleniyor...',
        reasoning: {
            completed: 'İşlem tamamlandı',
            thinking: 'İşlem devam ediyor...'
        },
        annotationText: 'bilgi elemanı'
    },
    Feedback: {
        submit: 'Göndermek',
        cancel: 'İptal'
    },
    AIChatInput: {
        template: 'Şablon',
        configure: 'Yapılandırma',
        selected: '${count} öğe seçildi',
    }
};

// [i18n-Turkish] 
export default local;
