import { ca } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'ca',
    dateFnsLocale: ca,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Articles per pàgina: ${pageSize}',
        total: 'Total de pàgines: ${total}',
        jumpTo: 'Salta a',
        page: ' pàgina',
    },
    Modal: {
        confirm: 'Confirma',
        cancel: 'Cancel·la',
    },
    Tabs: {
        more: "Més"
    },
    TimePicker: {
        placeholder: {
            time: 'Selecciona l\'hora',
            timeRange: 'Tria un interval d\'hores',
        },
        begin: 'Hora d\'inici',
        end: 'Hora de finalització',
        hour: '',
        minute: '',
        second: '',
        AM: 'a. m.',
        PM: 'p. m.',
    },
    DatePicker: {
        placeholder: {
            date: 'Selecciona una data',
            dateTime: 'Selecciona una data i hora',
            dateRange: ['Data d\'inici', 'Data de finalització'],
            dateTimeRange: ['Data d\'inici', 'Data de finalització'],
            monthRange: ['Mes d\'inici', 'Mes de finalització'],
        },
        presets: 'Ajustos predefinits',
        footer: {
            confirm: 'Confirma',
            cancel: 'Cancel·la',
        },
        selectDate: 'Selecciona una data',
        selectTime: 'Selecciona l\'hora',
        year: 'any',
        month: 'mes',
        day: 'dia',
        monthText: '${month} ${year}',
        months: {
            1: 'Gen',
            2: 'Feb',
            3: 'Març',
            4: 'Abr',
            5: 'Maig',
            6: 'Juny',
            7: 'Jul',
            8: 'Ago',
            9: 'Set',
            10: 'Oct',
            11: 'Nov',
            12: 'Des',
        },
        fullMonths: {
            1: 'Gener',
            2: 'Febrer',
            3: 'Març',
            4: 'Abril',
            5: 'Maig',
            6: 'Juny',
            7: 'Juliol',
            8: 'Agost',
            9: 'Setembre',
            10: 'Octubre',
            11: 'Novembre',
            12: 'Desembre',
        },
        weeks: {
            Mon: 'Dl.',
            Tue: 'Dt.',
            Wed: 'Dc.',
            Thu: 'Dj.',
            Fri: 'Dv.',
            Sat: 'Ds.',
            Sun: 'Dg.',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/mm/aaaa',
        },
    },
    Popconfirm: {
        confirm: 'Confirma',
        cancel: 'Cancel·la',
    },
    Navigation: {
        collapseText: 'Redueix la barra lateral',
        expandText: 'Amplia la barra lateral',
    },
    Table: {
        emptyText: 'Sense resultats',
        pageText: 'Es mostra d\'${currentStart} a ${currentEnd} de ${total}',
        descend: 'Fes clic per baixar',
        ascend: 'Fes clic per pujar',
        cancelSort: 'Cancel·la la classificació',
    },
    Select: {
        emptyText: 'Sense resultats',
        createText: 'Crea',
    },
    Cascader: {
        emptyText: 'Sense resultats',
    },
    Tree: {
        emptyText: 'Sense resultats',
        searchPlaceholder: 'Cerca',
    },
    List: {
        emptyText: 'Sense resultats',
    },
    Calendar: {
        allDay: 'Tot el dia',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} més',
    },
    Upload: {
        mainText: 'Fes clic per pujar o arrossegar el fitxer aquí',
        illegalTips: 'Aquest tipus de fitxer no s\'admet',
        legalTips: 'Deixa anar i inicia la pujada',
        retry: 'Torna-ho a provar',
        replace: 'Substitueix l\'arxiu',
        clear: 'Esborra',
        selectedFiles: 'Arxius seleccionats',
        illegalSize: 'Mida del fitxer il·legal',
        fail: 'No s\'ha pogut pujar',
    },
    TreeSelect: {
        searchPlaceholder: 'Cerca',
    },
    Typography: {
        copy: 'Copia',
        copied: 'S\'ha copiat',
        expand: 'Amplia',
        collapse: 'Redueix',
    },
    Transfer: {
        emptyLeft: 'No hi ha cap dada',
        emptySearch: 'No hi ha resultats de cerca',
        emptyRight: 'Sense contingut, comprova la part esquerra',
        placeholder: 'Cerca',
        clear: 'Esborra',
        selectAll: 'Selecciona-ho tot',
        clearSelectAll: 'Desmarca-ho tot',
        total: 'Total d\'articles: {total} $',
        selected: 'Articles seleccionats: {total} $',
    },
    Form: {
        optional: '(opcional)',
    },
    Image: {
        preview: 'Vista prèvia',
        loading: 'S\'està carregant',
        loadError: 'No s\'ha pogut carregar',
        prevTip: 'Anterior',
        nextTip: 'Següent',
        zoomInTip: 'Apropa',
        zoomOutTip: 'Allunya',
        rotateTip: 'Gira',
        downloadTip: 'Baixa',
        adaptiveTip: 'Adapta a la pàgina',
        originTip: 'Mida original',
    },
    Chat: {
        deleteConfirm: 'Segur que vols suprimir aquesta sessió?',
        clearContext: 'S\'ha esborrat el context',
        copySuccess: 'S\'ha copiat.',
        stop: 'Atura',
        copy: 'Copia',
        copied: 'Copiat',
        dropAreaText: 'Posa el fitxer aquí',
    },
    UserGuide: {
        skip: 'Omet',
        next: 'Següent',
        prev: 'Anterior',
        finish: 'Finalitza',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Cerca',
        replace: 'Substitueix',
        replaceAll: 'Substitueix-ho tot',
    },
    VideoPlayer: {
        rateChange: 'Canvia la velocitat a ${rate}',
        qualityChange: 'Canvia la qualitat a ${quality}',
        routeChange: 'Canvia la ruta a ${route}',
        mirror: 'Mirall',
        cancelMirror: 'Cancel·la el mirall',
        loading: 'S\'està carregant...',
        stall: 'No s\'ha pogut carregar',
        noResource: 'No hi ha cap recurs',
        videoError: 'Error en carregar el vídeo',
    },
    AIChatDialogue: {
        delete: 'Suprimeix',
        deleteConfirm: 'Segur que vols suprimir aquest missatge?',
        deleteContent: 'Aquest missatge se suprimirà de manera permanent i no es podrà recuperar.',
        copySuccess: 'S\'ha copiat',
        loading: 'S\'està carregant…',
        reasoning: {
            completed: 'S\'ha finalitzat el raonament',
            thinking: 'S\'està pensant…'
        },
        annotationText: 'fonts d\'informació'
    },
    Feedback: {
        submit: 'Envia',
        cancel: 'Cancel·la'
    },
    AIChatInput: {
        template: 'Plantilla',
        configure: 'Configura',
        selected: 'S\'han seleccionat ${count} elements',
    }
};

export default local;