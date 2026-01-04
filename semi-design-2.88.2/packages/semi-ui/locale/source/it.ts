import { it } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'it',
    dateFnsLocale: it,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Elementi per pagina: ${pageSize}',
        total: 'Pagine totali: ${total}',
        jumpTo: 'Vai a',
        page: ' pagine',
    },
    Modal: {
        confirm: 'Conferma',
        cancel: 'Cancella',
    },
    Tabs: {
        more: "Di più"
    },
    TimePicker: {
        placeholder: {
            time: 'Seleziona ora',
            timeRange: 'Seleziona un intervallo di tempo',
        },
        begin: 'Ora inizio',
        end: 'Ora fine',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'Seleziona data',
            dateTime: 'Seleziona data e ora',
            dateRange: ['Data inizio', 'Data fine'],
            dateTimeRange: ['Data inizio', 'Data fine'],
            monthRange: ['Mese inizio', 'Mese fine'],
        },
        presets: 'Preimpostazioni rapide',
        footer: {
            confirm: 'Conferma',
            cancel: 'Cancella',
        },
        selectDate: 'Seleziona data',
        selectTime: 'Seleziona ora',
        year: 'anno',
        month: 'mese',
        day: 'giorno',
        monthText: '${month} ${year}',
        months: {
            1: 'Gen',
            2: 'Feb',
            3: 'Mar',
            4: 'Apr',
            5: 'Mag',
            6: 'Giu',
            7: 'Lug',
            8: 'Ago',
            9: 'Set',
            10: 'Ott',
            11: 'Nov',
            12: 'Dic',
        },
        fullMonths: {
            1: 'Gennaio',
            2: 'Febbraio',
            3: 'Marzo',
            4: 'Aprile',
            5: 'Maggio',
            6: 'Giugno',
            7: 'Luglio',
            8: 'Agosto',
            9: 'Settembre',
            10: 'Ottobre',
            11: 'Novembre',
            12: 'Dicembre',
        },
        weeks: {
            Mon: 'Lun',
            Tue: 'Mar',
            Wed: 'Mer',
            Thu: 'Gio',
            Fri: 'Ven',
            Sat: 'Sab',
            Sun: 'Dom',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/MM/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Conferma',
        cancel: 'Cancella',
    },
    Navigation: {
        collapseText: 'Comprimi la barra laterale',
        expandText: 'Espandi la barra laterale',
    },
    Table: {
        emptyText: 'Nessun risultato',
        pageText: 'Mostra ${currentStart} a ${currentEnd} di ${total}',
        descend: 'Clicca per discendere',
        ascend: 'Clicca per ascendere',
        cancelSort: 'Annulla ordinamento',
    },
    Select: {
        emptyText: 'Nessun risultato',
        createText: 'Crea',
    },
    Tree: {
        emptyText: 'Nessun risultato',
        searchPlaceholder: 'Cerca',
    },
    Cascader: {
        emptyText: 'Nessun risultato',
    },
    List: {
        emptyText: 'Nessun risultato',
    },
    Calendar: {
        allDay: 'Tutto il giorno',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} più',
    },
    Upload: {
        mainText: 'Clicca per caricare il file o trascina il file qui',
        illegalTips: 'Questo tipo di file non è supportato',
        legalTips: 'Rilascia e inizia a caricare',
        retry: 'Riprova',
        replace: 'Sostituisci file',
        clear: 'Cancella',
        selectedFiles: 'File selezionati',
        illegalSize: 'Dimensione file errata',
        fail: 'Caricamento fallito',
    },
    TreeSelect: {
        searchPlaceholder: 'Cerca',
    },
    Typography: {
        copy: 'Copia',
        copied: 'Copiato',
        expand: 'Espandi',
        collapse: 'Comprimi',
    },
    Transfer: {
        emptyLeft: 'Nessun dato',
        emptySearch: 'Nessun risultato trovato',
        emptyRight: 'Nessun contenuto, controlla da sinistra',
        placeholder: 'Cerca',
        clear: 'Cancella',
        selectAll: 'Seleziona tutto',
        clearSelectAll: 'Deseleziona tutto',
        total: 'Elementi totali: ${total}',
        selected: 'Elementi selezionati: ${total}',
    },
    Form: {
        optional: '(opzionale)',
    },
    Image: {
        preview: 'Anteprima',
        loading: 'Caricamento in corso',
        loadError: 'Caricamento fallito',
        prevTip: 'Precedente',
        nextTip: 'Avanti',
        zoomInTip: 'Ingrandisci',
        zoomOutTip: 'rimpicciolisci',
        rotateTip: 'Ruota',
        downloadTip: 'scarica',
        adaptiveTip: 'Adatta alla pagina',
        originTip: 'Formato originale',
    },
    Chat: {
        deleteConfirm: 'Sei sicuro di voler eliminare questa conversazione?',
        clearContext: 'Il contesto è stato eliminato',
        copySuccess: 'Copiato con successo',
        stop: 'Fermare',
        copy: 'Copia',
        copied: 'Copiato',
        dropAreaText: 'Metti il file qui',
    },
    UserGuide: {
        skip: 'Salta',
        next: 'Avanti',
        prev: 'Indietro',
        finish: 'Fine',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Cerca',
        replace: 'Sostituisci',
        replaceAll: 'Sostituisci tutto',
    },
    VideoPlayer: {
        rateChange: 'Cambia velocità a ${rate}',
        qualityChange: 'Cambia qualità a ${quality}',
        routeChange: 'Cambia route a ${route}',
        mirror: 'Specchio',
        cancelMirror: 'Rimuovi specchio',
        loading: 'Caricamento in corso...',
        stall: 'Caricamento fallito',
        noResource: 'Nessuna risorsa',
        videoError: 'Errore di caricamento video'
    },
    AIChatDialogue: {
        delete: 'Elimina',
        deleteConfirm: 'Sei sicuro di voler eliminare questo messaggio?',
        deleteContent: 'Questo messaggio verrà eliminato permanentemente e non potrà essere recuperato.',
        copySuccess: 'Copiato con successo',
        loading: 'Caricamento in corso...',
        reasoning: {
            completed: 'Processo completato',
            thinking: 'Processo in corso...'
        },
        annotationText: 'elementi di informazione'
    },
    Feedback: {
        submit: 'Invia',
        cancel: 'Annulla'
    },
    AIChatInput: {
        template: 'Stampino',
        configure: 'Configurazione',
        selected: '${count} elementi selezionati',
    }
};

// [i18n-Italian]
export default local;
