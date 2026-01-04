import { es } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'es-419',
    dateFnsLocale: es,
    currency: 'USD',
    Pagination: {
        pageSize: 'Artículos por página: ${pageSize}',
        total: 'Total de páginas: ${total}',
        jumpTo: 'Ir a',
        page: ' página',
    },
    Modal: {
        confirm: 'Confirmar',
        cancel: 'Cancelar',
    },
    Tabs: {
        more: "Más"
    },
    TimePicker: {
        placeholder: {
            time: 'Selecciona la hora',
            timeRange: 'Selecciona un intervalo de tiempo',
        },
        begin: 'Hora de inicio',
        end: 'Hora de finalización',
        hour: '',
        minute: '',
        second: '',
        AM: 'a. m.',
        PM: 'p. m.',
    },
    DatePicker: {
        placeholder: {
            date: 'Selecciona la fecha',
            dateTime: 'Selecciona fecha y hora',
            dateRange: ['Fecha de inicio', 'Fecha de finalización'],
            dateTimeRange: ['Fecha de inicio', 'Fecha de finalización'],
            monthRange: ['Mes de inicio', 'Mes de finalización'],
        },
        presets: 'Ajustes preestablecidos',
        footer: {
            confirm: 'Confirmar',
            cancel: 'Cancelar',
        },
        selectDate: 'Selecciona la fecha',
        selectTime: 'Selecciona la hora',
        year: 'año',
        month: 'mes',
        day: 'día',
        monthText: '${month} ${year}',
        months: {
            1: 'Ene',
            2: 'Feb',
            3: 'Mar',
            4: 'Abr',
            5: 'May',
            6: 'Jun',
            7: 'Jul',
            8: 'Ago',
            9: 'Sep',
            10: 'Oct',
            11: 'Nov',
            12: 'Dic',
        },
        fullMonths: {
            1: 'Enero',
            2: 'Febrero',
            3: 'Marzo',
            4: 'Abril',
            5: 'Mayo',
            6: 'Junio',
            7: 'Julio',
            8: 'Agosto',
            9: 'Septiembre',
            10: 'Octubre',
            11: 'Noviembre',
            12: 'Diciembre',
        },
        weeks: {
            Mon: 'Lun',
            Tue: 'Mar',
            Wed: 'Mié',
            Thu: 'Jue',
            Fri: 'Vie',
            Sat: 'Sáb',
            Sun: 'Dom',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/MM/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Confirmar',
        cancel: 'Cancelar',
    },
    Navigation: {
        collapseText: 'Minimizar barra lateral',
        expandText: 'Ampliar barra lateral',
    },
    Table: {
        emptyText: 'No hay resultados',
        pageText: 'Mostrando de ${currentStart} a ${currentEnd} de ${total}',
        descend: 'Haz clic para bajar',
        ascend: 'Haz clic para subir',
        cancelSort: 'Cancelar clasificación',
    },
    Select: {
        emptyText: 'No hay resultados',
        createText: 'Crear',
    },
    Cascader: {
        emptyText: 'No hay resultados',
    },
    Tree: {
        emptyText: 'No hay resultados',
        searchPlaceholder: 'Buscar',
    },
    List: {
        emptyText: 'No hay resultados',
    },
    Calendar: {
        allDay: 'Todo el día',
        AM: '${time} a. m.',
        PM: '${time} p. m.',
        datestring: '',
        remaining: '${remained} más',
    },
    Upload: {
        mainText: 'Haz clic para cargar el archivo o arrástralo aquí',
        illegalTips: 'No se admite este tipo de archivo',
        legalTips: 'Suéltalo y comienza a cargar',
        retry: 'Reintentar',
        replace: 'Reemplazar el archivo',
        clear: 'Eliminar',
        selectedFiles: 'Archivos seleccionados',
        illegalSize: 'Tamaño de archivo ilegal',
        fail: 'No se pudo cargar',
    },
    TreeSelect: {
        searchPlaceholder: 'Buscar',
    },
    Typography: {
        copy: 'Copiar',
        copied: 'Copiado',
        expand: 'Ampliar',
        collapse: 'Minimizar',
    },
    Transfer: {
        emptyLeft: 'Sin datos',
        emptySearch: 'No hay resultados de búsqueda',
        emptyRight: 'No hay contenido, revisa a la izquierda',
        placeholder: 'Buscar',
        clear: 'Eliminar',
        selectAll: 'Seleccionar todo',
        clearSelectAll: 'Desmarcar todo',
        total: 'Total de artículos: ${total}',
        selected: 'Artículos seleccionados: ${total}',
    },
    Form: {
        optional: '(opcional)',
    },
    Image: {
        preview: 'Vista previa',
        loading: 'Cargando…',
        loadError: 'No se pudo cargar',
        prevTip: 'Anterior',
        nextTip: 'Siguiente',
        zoomInTip: 'Acercar',
        zoomOutTip: 'Alejar',
        rotateTip: 'Rotar',
        downloadTip: 'Descargar',
        adaptiveTip: 'Ajustar a la página',
        originTip: 'Tamaño original',
    },
    Chat: {
        deleteConfirm: '¿Seguro que quieres eliminar esta sesión?',
        clearContext: 'Contexto vaciado',
        copySuccess: 'Copia exitosa.',
        stop: 'Detener',
        copy: 'Copiar',
        copied: 'Copiado',
        dropAreaText: 'Deja el archivo aquí',
    },
    UserGuide: {
        skip: 'Omitir',
        next: 'Siguiente',
        prev: 'Anterior',
        finish: 'Terminar',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Buscar',
        replace: 'Reemplazar',
        replaceAll: 'Reemplazar todo',
    },
    VideoPlayer: {
        rateChange: 'Cambia la velocidad a ${rate}',
        qualityChange: 'Cambia la calidad a ${quality}',
        routeChange: 'Cambia la ruta a ${route}',
        mirror: 'Espejo',
        cancelMirror: 'Cancelar espejo',
        loading: 'Cargando…',
        stall: 'No se pudo cargar',
        noResource: 'No hay recursos',
        videoError: 'No se pudo cargar el video',
    },
    AIChatDialogue: {
        delete: 'Eliminar',
        deleteConfirm: '¿Seguro que quieres eliminar este mensaje?',
        deleteContent: 'Este mensaje se borrará permanentemente y no se puede recuperar.',
        copySuccess: 'Copia exitosa',
        loading: 'Cargando…',
        reasoning: {
            completed: 'Razonamiento completado',
            thinking: 'Pensando…'
        },
        annotationText: 'piezas de información'
    },
    Feedback: {
        submit: 'Enviar',
        cancel: 'Cancelar'
    },
    AIChatInput: {
        template: 'Plantilla',
        configure: 'Configurar',
        selected: '${count} artículos seleccionados',
    }
};

export default local;