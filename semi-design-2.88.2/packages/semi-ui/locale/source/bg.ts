import { bg } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'bg',
    dateFnsLocale: bg,
    currency: 'BGN',
    Pagination: {
        pageSize: 'Елементи на страница: ${pageSize}',
        total: 'Общо страници: ${total}',
        jumpTo: 'Преминаване към',
        page: ' страница',
    },
    Modal: {
        confirm: 'Потвърждаване',
        cancel: 'Отказ',
    },
    Tabs: {
        more: "Още"
    },
    TimePicker: {
        placeholder: {
            time: 'Изберете час',
            timeRange: 'Изберете часови диапазон',
        },
        begin: 'Начален час',
        end: 'Краен час',
        hour: '',
        minute: '',
        second: '',
        AM: 'Преди обед',
        PM: 'Следобед',
    },
    DatePicker: {
        placeholder: {
            date: 'Изберете дата',
            dateTime: 'Изберете дата и час',
            dateRange: ['Начална дата', 'Крайна дата'],
            dateTimeRange: ['Начална дата', 'Крайна дата'],
            monthRange: ['Начален месец', 'Краен месец'],
        },
        presets: 'Предварителни настройки',
        footer: {
            confirm: 'Потвърждаване',
            cancel: 'Отказ',
        },
        selectDate: 'Изберете дата',
        selectTime: 'Изберете час',
        year: 'година',
        month: 'месец',
        day: 'ден',
        monthText: '${month} ${year}',
        months: {
            1: 'ян.',
            2: 'февр.',
            3: 'март',
            4: 'апр.',
            5: 'май',
            6: 'юни',
            7: 'юли',
            8: 'авг.',
            9: 'септ.',
            10: 'окт.',
            11: 'ноем.',
            12: 'дек.',
        },
        fullMonths: {
            1: 'януари',
            2: 'февруари',
            3: 'март',
            4: 'април',
            5: 'май',
            6: 'юни',
            7: 'юли',
            8: 'август',
            9: 'септември',
            10: 'октомври',
            11: 'ноември',
            12: 'декември',
        },
        weeks: {
            Mon: 'пон.',
            Tue: 'вт.',
            Wed: 'ср.',
            Thu: 'четв.',
            Fri: 'пет.',
            Sat: 'съб.',
            Sun: 'нед.',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'ДД.ММ.ГГГГ',
        },
    },
    Popconfirm: {
        confirm: 'Потвърждаване',
        cancel: 'Отказ',
    },
    Navigation: {
        collapseText: 'Сгъване на страничната лента',
        expandText: 'Разгъване на страничната лента',
    },
    Table: {
        emptyText: 'Няма резултат',
        pageText: 'Показване на ${currentStart} до ${currentEnd} от ${total}',
        descend: 'Щракнете за низходящо',
        ascend: 'Щракнете за възходящо',
        cancelSort: 'Отмяна на сортирането',
    },
    Select: {
        emptyText: 'Няма резултат',
        createText: 'Създаване',
    },
    Cascader: {
        emptyText: 'Няма резултат',
    },
    Tree: {
        emptyText: 'Няма резултат',
        searchPlaceholder: 'Търсене',
    },
    List: {
        emptyText: 'Няма резултат',
    },
    Calendar: {
        allDay: 'Цял ден',
        AM: '${time} преди обед',
        PM: '${time} следобед',
        datestring: '',
        remaining: 'Още ${remained}',
    },
    Upload: {
        mainText: 'Щракнете, за да качите файл, или завлачете файла тук',
        illegalTips: 'Този тип файл не се поддържа',
        legalTips: 'Пуснете и започнете качването',
        retry: 'Повторен опит',
        replace: 'Заменете файла',
        clear: 'Изчистване',
        selectedFiles: 'Избрани файлове',
        illegalSize: 'Неправомерен размер на файла',
        fail: 'Неуспешно качване',
    },
    TreeSelect: {
        searchPlaceholder: 'Търсене',
    },
    Typography: {
        copy: 'Копиране',
        copied: 'Копирано',
        expand: 'Разгъване',
        collapse: 'Сгъване',
    },
    Transfer: {
        emptyLeft: 'Няма данни',
        emptySearch: 'Няма резултати от търсенето',
        emptyRight: 'Няма съдържание, проверете отляво',
        placeholder: 'Търсене',
        clear: 'Изчистване',
        selectAll: 'Избор на всички',
        clearSelectAll: 'Премахване на избора на всички',
        total: 'Общо елементи: ${total}',
        selected: 'Избрани елементи: ${total}',
    },
    Form: {
        optional: '(по избор)',
    },
    Image: {
        preview: 'Визуализация',
        loading: 'Зареждане',
        loadError: 'Неуспешно зареждане',
        prevTip: 'Предишно',
        nextTip: 'Следващо',
        zoomInTip: 'Увеличаване',
        zoomOutTip: 'Намаляване',
        rotateTip: 'Завъртане',
        downloadTip: 'Изтегляне',
        adaptiveTip: 'Адаптиране към страницата',
        originTip: 'Оригинален размер',
    },
    Chat: {
        deleteConfirm: 'Сигурни ли сте, че искате да изтриете тази сесия?',
        clearContext: 'Контекстът е изчистен',
        copySuccess: 'Копирането е успешно.',
        stop: 'Спиране',
        copy: 'Копиране',
        copied: 'Копирано',
        dropAreaText: 'Поставете файла тук',
    },
    UserGuide: {
        skip: 'Пропускане',
        next: 'Следващо',
        prev: 'Предишно',
        finish: 'Завършване',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Търсене',
        replace: 'Заместване',
        replaceAll: 'Заместване на всички',
    },
    VideoPlayer: {
        rateChange: 'Превключване на скоростта на ${rate}',
        qualityChange: 'Превключване на качеството на ${quality}',
        routeChange: 'Превключване на пътя на ${route}',
        mirror: 'Дублиране',
        cancelMirror: 'Отмяна на дублирането',
        loading: 'Зареждане...',
        stall: 'Зареждането е неуспешно',
        noResource: 'Няма ресурс',
        videoError: 'Грешка при зареждане на видео',
    },
    AIChatDialogue: {
        delete: 'Изтриване',
        deleteConfirm: 'Сигурни ли сте, че искате да изтриете това съобщение?',
        deleteContent: 'Това съобщение ще бъде постоянно изтрито и не може да бъде възстановено.',
        copySuccess: 'Копирането е успешно',
        loading: 'Зареждане...',
        reasoning: {
            completed: 'Обосновката е завършена',
            thinking: 'Мислене...'
        },
        annotationText: 'парчета информация'
    },
    Feedback: {
        submit: 'Подаване',
        cancel: 'Отказ'
    },
    AIChatInput: {
        template: 'Шаблон',
        configure: 'Конфигуриране',
        selected: 'Избрани ${count} елемента',
    }
};

// [i18n-Bulgarian]
export default local;