import { ptBR } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'pt-BR',
    dateFnsLocale: ptBR,
    currency: 'BRL',
    Pagination: {
        pageSize: 'Itens por página: ${pageSize}',
        total: 'Total de páginas: ${total}',
        jumpTo: 'Pule para',
        page: 'página',
    },
    Modal: {
        confirm: 'OK',
        cancel: 'Cancelar',
    },
    Tabs: {
        more: "Mais"
    },
    TimePicker: {
        placeholder: {
            time: 'Por favor escolha a hora',
            timeRange: 'Selecione um intervalo de tempo',
        },  
        begin: 'Hora de início',
        end: 'Fim do tempo',
        hour: '',
        minute: '',
        second: '',
        AM: 'manhã',
        PM: 'a tarde',
    },
    DatePicker: {
        placeholder: {
            date: 'Por favor selecione uma data',
            dateTime: 'Selecione a data e hora',
            dateRange: ['Data de início', 'Data de fim'],
            dateTimeRange: ['Data de início', 'Data de fim'],
            monthRange: ['Mês de início', 'Mês de fim'],
        },
        presets: 'Seleção rápida',
        footer: {
            confirm: 'OK',
            cancel: 'Cancelar',
        },
        selectDate: 'Voltar para selecionar a data',
        selectTime: 'período de seleção',
        year: 'ano',
        month: 'mês',
        day: 'dia',
        monthText: '${year} ano ${month}', // 此处不使用标准token是因为需要做replace，月份M这个Token可能会被误伤，例如May
        months: {
            1: 'Jan',
            2: 'Feb',
            3: 'Mar',
            4: 'Apr',
            5: 'May',
            6: 'Jun',
            7: 'Jul',
            8: 'Aug',
            9: 'Sep',
            10: 'Oct',
            11: 'Nov',
            12: 'Dec',
        },
        fullMonths: {
            1: 'janeiro',
            2: 'fevereiro',
            3: 'março',
            4: 'abril',
            5: 'maio',
            6: 'junho',
            7: 'julho',
            8: 'agosto',
            9: 'setembro',
            10: 'outubro',
            11: 'novembro',
            12: 'dezembro',
        },
        // 葡萄牙语完整的周一、周日文本太长了，这里沿用英文
        weeks: {
            // Mon: 'segunda feira',
            // Tue: 'terça feira',
            // Wed: 'quarta feira',
            // Thu: 'quinta feira',
            // Fri: 'sexta feira',
            // Sat: 'sábado',
            // Sun: 'domingo',
            Mon: 'Mon',
            Tue: 'Tue',
            Wed: 'Wed',
            Thu: 'Thu',
            Fri: 'Fri',
            Sat: 'Sat',
            Sun: 'Sun',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd-MM-yyyy',
        },
    },
    Navigation: {
        collapseText: 'Recolher a barra lateral',
        expandText: 'Expanda a barra lateral',
    },
    Popconfirm: {
        confirm: 'OK',
        cancel: 'Cancelar',
    },
    Table: {
        emptyText: 'Não há dados',
        pageText: 'Mostrando ${currentStart} - ${currentEnd} ，de ${total}',
        descend: 'Clique para descrescer',
        ascend: 'Clique para crescer',
        cancelSort: 'Cancelar classificação',
    },
    Select: {
        emptyText: 'Não há dados',
        createText: 'Criar',
    },
    Cascader: {
        emptyText: 'Não há dados',
    },
    Tree: {
        emptyText: 'Não há dados',
        searchPlaceholder: 'procurar',
    },
    List: {
        emptyText: 'Não há dados',
    },
    Calendar: {
        allDay: 'Dia',
        AM: '${time} tempo manhã',
        PM: '${time} à tarde',
        datestring: 'dia',
        remaining: 'Mais ${remained}',
    },
    Upload: {
        mainText: 'Clique para fazer upload do arquivo ou arraste e solte o arquivo aqui',
        illegalTips: 'Arquivo deste tipo não é compatível',
        legalTips: 'Solte e comece a enviar',
        retry: 'Tentar novamente',
        replace: 'Substituir arquivo',
        clear: 'Vazio',
        selectedFiles: 'Arquivo selecionado',
        illegalSize: 'O tamanho do arquivo é ilegal',
        fail: 'upload falhou',
    },
    TreeSelect: {
        searchPlaceholder: 'procurar',
    },
    Typography: {
        copy: 'Copiar',
        copied: 'Cópia bem sucedida',
        expand: 'Expandir',
        collapse: 'Recolher',
    },
    Transfer: {
        emptyLeft: 'Não há dados',
        emptySearch: 'Sem resultados de pesquisa',
        emptyRight: 'Não há conteúdo ainda, você pode conferir da esquerda',
        placeholder: 'procurar',
        clear: 'Vazio',
        selectAll: 'selecionar tudo',
        clearSelectAll: 'Cancelar selecionar tudo',
        total: 'Total de itens: ${total}',
        selected: 'Itens selecionados: ${total}',
    },
    Form: {
        optional: '(opcional)',
    },
    Image: {
        preview: 'Visualizar',
        loading: 'Carregando',
        loadError: 'Falha ao carregar',
        prevTip: 'Anterior',
        nextTip: 'Próximo',
        zoomInTip: 'Ampliar',
        zoomOutTip: 'reduzir',
        rotateTip: 'Girar',
        downloadTip: 'baixar',
        adaptiveTip: 'Adaptar à página',
        originTip: 'Tamanho original',
    },
    Chat: {
        deleteConfirm: 'Você tem certeza de que deseja excluir esta sessão?',
        clearContext: 'Contexto limpo',
        copySuccess: 'Copiado com sucesso',
        stop: 'Parar',
        copy: 'Copiar',
        copied: 'Cópia bem sucedida',
        dropAreaText: 'Coloque o arquivo aqui',
    },
    UserGuide: {
        skip: 'Pular',
        next: 'Próximo',
        prev: 'Anterior',
        finish: 'Finalizar',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Pesquisar',
        replace: 'Substituir',
        replaceAll: 'Substituir tudo',
    },
    VideoPlayer: {
        rateChange: 'Mudar velocidade para ${rate}',
        qualityChange: 'Mudar qualidade para ${quality}',
        routeChange: 'Mudar rota para ${route}',
        mirror: 'Espelho',
        cancelMirror: 'Remover espelho',
        loading: 'Carregando...',
        stall: 'Carregamento falhou',
        noResource: 'Sem recurso',
        videoError: 'Erro ao carregar vídeo'
    },
    AIChatDialogue: {
        delete: 'Excluir',
        deleteConfirm: 'Tem certeza que deseja excluir esta sessão?',
        deleteContent: 'Esta sessão será excluída permanentemente e não poderá ser recuperada.',
        copySuccess: 'Copiado com sucesso',
        loading: 'Carregando...',
        reasoning: {
            completed: 'Processo completado',
            thinking: 'Processo em andamento...'
        },
        annotationText: 'elementos de informação'
    },
    Feedback: {
        submit: 'Enviar',
        cancel: 'Cancelar'
    },
    AIChatInput: {
        template: 'Estêncil',
        configure: 'Configuração',
        selected: '${count} itens selecionados',
    }
};

// 葡萄牙语
export default local;
