import { pt } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'pt',
    dateFnsLocale: pt,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Itens por página: ${pageSize}',
        total: 'Total de páginas: ${total}',
        jumpTo: 'Ir para',
        page: ' página',
    },
    Modal: {
        confirm: 'Confirmar',
        cancel: 'Cancelar',
    },
    Tabs: {
        more: "Mais"
    },
    TimePicker: {
        placeholder: {
            time: 'Selecionar hora',
            timeRange: 'Seleciona um intervalo de tempo',
        },
        begin: 'Hora de início',
        end: 'Hora de fim',
        hour: '',
        minute: '',
        second: '',
        AM: 'Manhã',
        PM: 'Tarde/noite',
    },
    DatePicker: {
        placeholder: {
            date: 'Selecionar data',
            dateTime: 'Seleciona uma data e hora',
            dateRange: ['Data de início', 'Data de fim'],
            dateTimeRange: ['Data de início', 'Data de fim'],
            monthRange: ['Mês de início', 'Mês de fim'],
        },
        presets: 'Predefinições',
        footer: {
            confirm: 'Confirmar',
            cancel: 'Cancelar',
        },
        selectDate: 'Selecionar data',
        selectTime: 'Selecionar hora',
        year: 'ano',
        month: 'mês',
        day: 'dia',
        monthText: '${month} ${year}',
        months: {
            1: 'Jan',
            2: 'Fev',
            3: 'Mar',
            4: 'Abr',
            5: 'Mai',
            6: 'Jun',
            7: 'Jul',
            8: 'Ago',
            9: 'Set',
            10: 'Out',
            11: 'Nov',
            12: 'Dez',
        },
        fullMonths: {
            1: 'Janeiro',
            2: 'Fevereiro',
            3: 'Março',
            4: 'Abril',
            5: 'Maio',
            6: 'Junho',
            7: 'Julho',
            8: 'Agosto',
            9: 'Setembro',
            10: 'Outubro',
            11: 'Novembro',
            12: 'Dezembro',
        },
        weeks: {
            Mon: 'Seg',
            Tue: 'Ter',
            Wed: 'Qua',
            Thu: 'Qui',
            Fri: 'Sex',
            Sat: 'Sáb',
            Sun: 'Dom',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'MM/dd/aaaa',
        },
    },
    Popconfirm: {
        confirm: 'Confirmar',
        cancel: 'Cancelar',
    },
    Navigation: {
        collapseText: 'Reduzir barra lateral',
        expandText: 'Expandir barra lateral',
    },
    Table: {
        emptyText: 'Sem resultados',
        pageText: 'A mostrar ${currentStart} a ${currentEnd} de ${total}',
        descend: 'Clica para decrescer',
        ascend: 'Clica para ascender',
        cancelSort: 'Cancelar classificação',
    },
    Select: {
        emptyText: 'Sem resultados',
        createText: 'Criar',
    },
    Cascader: {
        emptyText: 'Sem resultados',
    },
    Tree: {
        emptyText: 'Sem resultados',
        searchPlaceholder: 'Pesquisar',
    },
    List: {
        emptyText: 'Sem resultados',
    },
    Calendar: {
        allDay: 'Todo o dia',
        AM: '${time} da manhã',
        PM: '${time} da tarde/noite',
        datestring: '',
        remaining: 'Mais ${remained}',
    },
    Upload: {
        mainText: 'Clica para carregar o ficheiro ou arrasta o ficheiro para aqui',
        illegalTips: 'Este tipo de ficheiro não é suportado',
        legalTips: 'Larga e começa o carregamento',
        retry: 'Tentar novamente',
        replace: 'Substituir ficheiro',
        clear: 'Limpar',
        selectedFiles: 'Ficheiros selecionados',
        illegalSize: 'Tamanho de ficheiro ilegal',
        fail: 'O carregamento falhou',
    },
    TreeSelect: {
        searchPlaceholder: 'Pesquisar',
    },
    Typography: {
        copy: 'Copiar',
        copied: 'Copiado',
        expand: 'Expandir',
        collapse: 'Reduzir',
    },
    Transfer: {
        emptyLeft: 'Sem dados',
        emptySearch: 'Sem resultados de pesquisa',
        emptyRight: 'Sem conteúdo; verificar lado esquerdo',
        placeholder: 'Pesquisar',
        clear: 'Limpar',
        selectAll: 'Selecionar tudo',
        clearSelectAll: 'Desmarcar tudo',
        total: 'Total de itens: ${total}',
        selected: 'Itens selecionados: ${total}',
    },
    Form: {
        optional: '(opcional)',
    },
    Image: {
        preview: 'Pré-visualizar',
        loading: 'A carregar',
        loadError: 'Falha ao carregar',
        prevTip: 'Anterior',
        nextTip: 'Seguinte',
        zoomInTip: 'Aumentar o zoom',
        zoomOutTip: 'Diminuir o zoom',
        rotateTip: 'Rodar',
        downloadTip: 'Descarregar',
        adaptiveTip: 'Adaptar à página',
        originTip: 'Tamanho original',
    },
    Chat: {
        deleteConfirm: 'Tens a certeza de que queres eliminar esta sessão?',
        clearContext: 'Contexto limpo',
        copySuccess: 'Cópia bem-sucedida.',
        stop: 'Parar',
        copy: 'Copiar',
        copied: 'Copiado',
        dropAreaText: 'Coloca o ficheiro aqui',
    },
    UserGuide: {
        skip: 'Ignorar',
        next: 'Seguinte',
        prev: 'Ant',
        finish: 'Concluir',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Pesquisar',
        replace: 'Substituir',
        replaceAll: 'Substituir tudo',
    },
    VideoPlayer: {
        rateChange: 'Alterar velocidade para ${rate}',
        qualityChange: 'Alterar qualidade para ${quality}',
        routeChange: 'Alterar rota para ${route}',
        mirror: 'Espelhar',
        cancelMirror: 'Cancelar espelhamento',
        loading: 'A carregar...',
        stall: 'O carregamento falhou',
        noResource: 'Sem recursos',
        videoError: 'Erro de carregamento de vídeo',
    },
    AIChatDialogue: {
        delete: 'Eliminar',
        deleteConfirm: 'Tens a certeza de que queres eliminar esta mensagem?',
        deleteContent: 'Esta mensagem será eliminada permanentemente e não poderá ser recuperada.',
        copySuccess: 'Cópia bem-sucedida',
        loading: 'A carregar...',
        reasoning: {
            completed: 'Raciocínio concluído',
            thinking: 'A pensar...'
        },
        annotationText: 'informações'
    },
    Feedback: {
        submit: 'Enviar',
        cancel: 'Cancelar'
    },
    AIChatInput: {
        template: 'Modelo',
        configure: 'Configurar',
        selected: '${count} itens selecionados',
    }
};

export default local;