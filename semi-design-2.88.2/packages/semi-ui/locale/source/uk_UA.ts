import { uk } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'uk-UA',
    dateFnsLocale: uk,
    currency: 'UAH',
    Pagination: {
        pageSize: 'Кількість елементів на сторінці: ${pageSize}',
        total: 'Усього сторінок: ${total}',
        jumpTo: 'Перейти до',
        page: ' стор.',
    },
    Modal: {
        confirm: 'Підтвердити',
        cancel: 'Скасувати',
    },
    Tabs: {
        more: "Більше"
    },
    TimePicker: {
        placeholder: {
            time: 'Вибери час',
            timeRange: 'Вибери часовий діапазон',
        },
        begin: 'Час початку',
        end: 'Час закінчення',
        hour: '',
        minute: '',
        second: '',
        AM: 'до полудня',
        PM: 'після полудня',
    },
    DatePicker: {
        placeholder: {
            date: 'Вибери дату',
            dateTime: 'Вибери дату та час',
            dateRange: ['Дата початку', 'Дата закінчення'],
            dateTimeRange: ['Дата початку', 'Дата закінчення'],
            monthRange: ['Місяць початку', 'Місяць закінчення'],
        },
        presets: 'Пресети',
        footer: {
            confirm: 'Підтвердити',
            cancel: 'Скасувати',
        },
        selectDate: 'Вибери дату',
        selectTime: 'Вибери час',
        year: 'рік',
        month: 'місяць',
        day: 'день',
        monthText: '${month} ${year}',
        months: {
            1: 'Січ',
            2: 'Лют',
            3: 'Бер',
            4: 'Квіт',
            5: 'Травень',
            6: 'Черв',
            7: 'Лип',
            8: 'Серп',
            9: 'Вер',
            10: 'Жовт',
            11: 'Лист',
            12: 'Груд',
        },
        fullMonths: {
            1: 'Січень',
            2: 'Лютий',
            3: 'Березень',
            4: 'Квітень',
            5: 'Травень',
            6: 'Червень',
            7: 'Липень',
            8: 'Серпень',
            9: 'Вересень',
            10: 'Жовтень',
            11: 'Листопад',
            12: 'Грудень',
        },
        weeks: {
            Mon: 'Пн',
            Tue: 'Вт',
            Wed: 'Ср',
            Thu: 'Чт',
            Fri: 'Пт',
            Sat: 'Сб',
            Sun: 'Нд',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'дд.мм.рррр',
        },
    },
    Popconfirm: {
        confirm: 'Підтвердити',
        cancel: 'Скасувати',
    },
    Navigation: {
        collapseText: 'Згорнути бічну панель',
        expandText: 'Розгорнути бічну панель',
    },
    Table: {
        emptyText: 'Без результату',
        pageText: 'Показано ${currentStart}–${currentEnd} з ${total}',
        descend: 'Натисни, щоб опуститися',
        ascend: 'Натисни, щоб піднятися',
        cancelSort: 'Скасувати сортування',
    },
    Select: {
        emptyText: 'Без результату',
        createText: 'Створити',
    },
    Cascader: {
        emptyText: 'Без результату',
    },
    Tree: {
        emptyText: 'Без результату',
        searchPlaceholder: 'Пошук',
    },
    List: {
        emptyText: 'Без результату',
    },
    Calendar: {
        allDay: 'Увесь день',
        AM: '${time} до полудня',
        PM: '${time} після полудня',
        datestring: '',
        remaining: '${remained} ще',
    },
    Upload: {
        mainText: 'Натисни, щоб завантажити файл, або перетягни файл сюди',
        illegalTips: 'Цей тип файлу не підтримується',
        legalTips: 'Опублікуй та почни завантаження',
        retry: 'Повторити спробу',
        replace: 'Замінити файл',
        clear: 'Очистити',
        selectedFiles: 'Вибрані файли',
        illegalSize: 'Недопустимий розмір файлу',
        fail: 'Помилка завантаження',
    },
    TreeSelect: {
        searchPlaceholder: 'Пошук',
    },
    Typography: {
        copy: 'Копіювати',
        copied: 'Скопійовано',
        expand: 'Розгорнути',
        collapse: 'Згорнути',
    },
    Transfer: {
        emptyLeft: 'Немає даних',
        emptySearch: 'Нічого не знайдено',
        emptyRight: 'Немає контенту, перевір зліва',
        placeholder: 'Пошук',
        clear: 'Очистити',
        selectAll: 'Вибрати все',
        clearSelectAll: 'Скасувати вибір усього',
        total: 'Усього товарів: ${total}',
        selected: 'Вибрано товарів: ${total}',
    },
    Form: {
        optional: '(необов\'язково)',
    },
    Image: {
        preview: 'Попередній перегляд',
        loading: 'Завантаження',
        loadError: 'Не вдалося завантажити',
        prevTip: 'Попередня',
        nextTip: 'Далі',
        zoomInTip: 'Наблизити',
        zoomOutTip: 'Віддалити',
        rotateTip: 'Повернути',
        downloadTip: 'Завантажити',
        adaptiveTip: 'Адаптувати до сторінки',
        originTip: 'Оригінальний розмір',
    },
    Chat: {
        deleteConfirm: 'Видалити цей сеанс?',
        clearContext: 'Контекст очищено',
        copySuccess: 'Копіювання успішне.',
        stop: 'Зупинити',
        copy: 'Копіювати',
        copied: 'Скопійовано',
        dropAreaText: 'Помісти файл сюди',
    },
    UserGuide: {
        skip: 'Пропустити',
        next: 'Далі',
        prev: 'Попередня',
        finish: 'Завершити',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Пошук',
        replace: 'Замінити',
        replaceAll: 'Замінити все',
    },
    VideoPlayer: {
        rateChange: 'Змінити тариф на ${rate}',
        qualityChange: 'Змінити якість на ${quality}',
        routeChange: 'Перемкнути маршрут на ${route}',
        mirror: 'Дзеркальний режим',
        cancelMirror: 'Скасувати дзеркальний режим',
        loading: 'Завантаження...',
        stall: 'Не вдалося завантажити',
        noResource: 'Немає ресурсу',
        videoError: 'Помилка завантаження відео',
    },
    AIChatDialogue: {
        delete: 'Видалити',
        deleteConfirm: 'Ти впевнений, що хочеш видалити це повідомлення?',
        deleteContent: 'Це повідомлення буде назавжди видалено та не може бути відновлено.',
        copySuccess: 'Копіювання успішне',
        loading: 'Завантаження...',
        reasoning: {
            completed: 'Міркування завершено',
            thinking: 'Міркування...'
        },
        annotationText: 'частини інформації'
    },
    Feedback: {
        submit: 'Надіслати',
        cancel: 'Скасувати'
    },
    AIChatInput: {
        template: 'Шаблон',
        configure: 'Налаштувати',
        selected: 'Вибрано елементів: ${count}',
    }
};

export default local;