import { hr } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'hr',
    dateFnsLocale: hr,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Stavki po stranici: ${pageSize}',
        total: 'Ukupno stranica: ${total}',
        jumpTo: 'Preskoči na',
        page: ' str.',
    },
    Modal: {
        confirm: 'Potvrdi',
        cancel: 'Odustani',
    },
    Tabs: {
        more: "Više"
    },
    TimePicker: {
        placeholder: {
            time: 'Odaberi vrijeme',
            timeRange: 'Odaberi razdoblje',
        },
        begin: 'Vrijeme početka',
        end: 'Vrijeme završetka',
        hour: '',
        minute: '',
        second: '',
        AM: 'prijepodne',
        PM: 'poslijepodne',
    },
    DatePicker: {
        placeholder: {
            date: 'Odaberi datum',
            dateTime: 'Odaberi datum i vrijeme',
            dateRange: ['Datum početka', 'Datum završetka'],
            dateTimeRange: ['Datum početka', 'Datum završetka'],
            monthRange: ['Mjesec početka', 'Mjesec završetka'],
        },
        presets: 'Unaprijed postavljeno',
        footer: {
            confirm: 'Potvrdi',
            cancel: 'Odustani',
        },
        selectDate: 'Odaberi datum',
        selectTime: 'Odaberi vrijeme',
        year: 'godina',
        month: 'mjesec',
        day: 'dan',
        monthText: '${month} ${year}',
        months: {
            1: 'sij',
            2: 'velj',
            3: 'ožu',
            4: 'tra',
            5: 'svi',
            6: 'lip',
            7: 'srp',
            8: 'kol',
            9: 'ruj',
            10: 'lis',
            11: 'stu',
            12: 'pro',
        },
        fullMonths: {
            1: 'siječanj',
            2: 'veljača',
            3: 'ožujak',
            4: 'travanj',
            5: 'svibanj',
            6: 'lipanj',
            7: 'srpanj',
            8: 'kolovoz',
            9: 'rujan',
            10: 'listopad',
            11: 'studeni',
            12: 'prosinac',
        },
        weeks: {
            Mon: 'pon',
            Tue: 'uto',
            Wed: 'sri',
            Thu: 'čet',
            Fri: 'pet',
            Sat: 'sub',
            Sun: 'ned',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd.MM.yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Potvrdi',
        cancel: 'Odustani',
    },
    Navigation: {
        collapseText: 'Sažmi bočnu traku',
        expandText: 'Proširi bočnu traku',
    },
    Table: {
        emptyText: 'Nema rezultata',
        pageText: 'Prikazuje se ${currentStart} – ${currentEnd} od ${total}',
        descend: 'Klikni za silazno',
        ascend: 'Klikni za uzlazno',
        cancelSort: 'Otkaži sortiranje',
    },
    Select: {
        emptyText: 'Nema rezultata',
        createText: 'Kreiraj',
    },
    Cascader: {
        emptyText: 'Nema rezultata',
    },
    Tree: {
        emptyText: 'Nema rezultata',
        searchPlaceholder: 'Pretraži',
    },
    List: {
        emptyText: 'Nema rezultata',
    },
    Calendar: {
        allDay: 'Cijeli dan',
        AM: '${time} prijepodne',
        PM: '${time} poslijepodne',
        datestring: '',
        remaining: 'još ${remained}',
    },
    Upload: {
        mainText: 'Klikni za prijenos ili povlačenje datoteke ovdje',
        illegalTips: 'Ova vrsta datoteke nije podržana',
        legalTips: 'Otpusti i započni prijenos',
        retry: 'Pokušaj ponovno',
        replace: 'Zamijeni datoteku',
        clear: 'Izbriši',
        selectedFiles: 'Odabrane datoteke',
        illegalSize: 'Nedopuštena veličina datoteke',
        fail: 'Prijenos nije uspio',
    },
    TreeSelect: {
        searchPlaceholder: 'Pretraži',
    },
    Typography: {
        copy: 'Kopiraj',
        copied: 'Kopirano',
        expand: 'Proširi',
        collapse: 'Sažmi',
    },
    Transfer: {
        emptyLeft: 'Nema podataka',
        emptySearch: 'Nema rezultata pretraživanja',
        emptyRight: 'Nema sadržaja, provjeri slijeva',
        placeholder: 'Pretraži',
        clear: 'Izbriši',
        selectAll: 'Odaberi sve',
        clearSelectAll: 'Poništi odabir',
        total: 'Ukupno stavki: ${total}',
        selected: 'Odabrano stavki: ${total}',
    },
    Form: {
        optional: '(neobavezno)',
    },
    Image: {
        preview: 'Pretpregled',
        loading: 'Učitava se...',
        loadError: 'Učitavanje nije uspjelo',
        prevTip: 'Prethodno',
        nextTip: 'Sljedeće',
        zoomInTip: 'Povećaj prikaz',
        zoomOutTip: 'Smanji prikaz',
        rotateTip: 'Zakreni',
        downloadTip: 'Preuzmi',
        adaptiveTip: 'Prilagodi stranici',
        originTip: 'Izvorna veličina',
    },
    Chat: {
        deleteConfirm: 'Sigurno želiš izbrisati ovu sesiju?',
        clearContext: 'Kontekst je izbrisan',
        copySuccess: 'Kopiranje je uspjelo.',
        stop: 'Zaustavi',
        copy: 'Kopiraj',
        copied: 'Kopirano',
        dropAreaText: 'Ispusti datoteku ovdje',
    },
    UserGuide: {
        skip: 'Preskoči',
        next: 'Sljedeće',
        prev: 'Pret.',
        finish: 'Dovrši',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Pretraži',
        replace: 'Zamijeni',
        replaceAll: 'Zamijeni sve',
    },
    VideoPlayer: {
        rateChange: 'Promijeni brzinu u ${rate}',
        qualityChange: 'Promijeni kvalitetu u ${quality}',
        routeChange: 'Promijeni rutu u ${route}',
        mirror: 'Zrcalo',
        cancelMirror: 'Otkaži zrcalo',
        loading: 'Učitava se...',
        stall: 'Učitavanje nije uspjelo',
        noResource: 'Nema sadržaja',
        videoError: 'Pogreška učitavanja videozapisa',
    },
    AIChatDialogue: {
        delete: 'Izbriši',
        deleteConfirm: 'Jesi li siguran/na da želiš izbrisati ovu poruku?',
        deleteContent: 'Poruka će se trajno izbrisati i neće se moći oporaviti.',
        copySuccess: 'Kopiranje je uspjelo',
        loading: 'Učitavanje...',
        reasoning: {
            completed: 'Obrazlaganje dovršeno',
            thinking: 'Razmišljam...'
        },
        annotationText: 'informacije'
    },
    Feedback: {
        submit: 'Pošalji',
        cancel: 'Odustani'
    },
    AIChatInput: {
        template: 'Predložak',
        configure: 'Konfiguriraj',
        selected: 'Odabrane stavke: ${count}',
    }
};

export default local;