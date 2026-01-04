import { th } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'my-MM',
    dateFnsLocale: th,
    currency: 'USD',
    Pagination: {
        pageSize: 'စာမျက်နှာတစ်ခုလျှင် ပစ္စည်းအရေအတွက်- ${pageSize}',
        total: 'စာမျက်နှာ စုစုပေါင်း- ${total}',
        jumpTo: 'ခုန်ကူးရန်',
        page: ' စာမျက်နှာ',
    },
    Modal: {
        confirm: 'အတည်ပြုမည်',
        cancel: 'ပယ်ဖျက်မည်',
    },
    Tabs: {
        more: "နောက်ထပ်"
    },
    TimePicker: {
        placeholder: {
            time: 'အချိန် ရွေးချယ်ပါ',
            timeRange: 'အချိန်အပိုင်းအခြားတစ်ခု ရွေးချယ်ပါ',
        },
        begin: 'စတင်ချိန်',
        end: 'ပြီးဆုံးချိန်',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'ရက်စွဲ ရွေးချယ်ပါ',
            dateTime: 'ရက်စွဲနှင့် အချိန်ကို ရွေးချယ်ပါ',
            dateRange: ['စတင်ရက်', 'ပြီးဆုံးရက်'],
            dateTimeRange: ['စတင်ရက်', 'ပြီးဆုံးရက်'],
            monthRange: ['စတင်သည့်လ', 'ပြီးဆုံးသည့်လ'],
        },
        presets: 'ကြိုတင်သတ်မှတ်မှုများ',
        footer: {
            confirm: 'အတည်ပြုမည်',
            cancel: 'ပယ်ဖျက်မည်',
        },
        selectDate: 'ရက်စွဲ ရွေးချယ်ပါ',
        selectTime: 'အချိန် ရွေးချယ်ပါ',
        year: 'နှစ်',
        month: 'လ',
        day: 'ရက်',
        monthText: '${month} ${year}',
        months: {
            1: 'ဇန်',
            2: 'ဖေ',
            3: 'မတ်',
            4: 'ဧ',
            5: 'မေ',
            6: 'ဇွန်',
            7: 'ဇူ',
            8: 'သြ',
            9: 'စက်',
            10: 'အောက်',
            11: 'နို',
            12: 'ဒီ',
        },
        fullMonths: {
            1: 'ဇန်နဝါရီ',
            2: 'ဖေဖော်ဝါရီ',
            3: 'မတ်',
            4: 'ဧပြီ',
            5: 'မေ',
            6: 'ဇွန်',
            7: 'ဇူလိုင်',
            8: 'ဩဂုတ်',
            9: 'စက်တင်ဘာ',
            10: 'အောက်တိုဘာ',
            11: 'နိုဝင်ဘာ',
            12: 'ဒီဇင်ဘာ',
        },
        weeks: {
            Mon: 'လာ',
            Tue: 'ဂါ',
            Wed: 'ဟူး',
            Thu: 'ကြာ',
            Fri: 'သော',
            Sat: 'နေ',
            Sun: 'နွေ',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/MM/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'အတည်ပြုမည်',
        cancel: 'ပယ်ဖျက်မည်',
    },
    Navigation: {
        collapseText: 'ဘေးဘားကို ချုံ့ရန်',
        expandText: 'ဘေးဘားကို ချဲ့ရန်',
    },
    Table: {
        emptyText: 'ရလဒ်မရှိပါ',
        pageText: '${total} ၏ ${currentStart} မှ ${currentEnd} အထိ ပြသထားသည်',
        descend: 'အောက်သို့ဆင်းရန် နှိပ်ပါ',
        ascend: 'အပေါ်သို့တက်ရန် နှိပ်ပါ',
        cancelSort: 'စီခြင်းကို ပယ်ဖျက်မည်',
    },
    Select: {
        emptyText: 'ရလဒ်မရှိပါ',
        createText: 'ဖန်တီးမည်',
    },
    Cascader: {
        emptyText: 'ရ�ဒ်မရှိပါ',
    },
    Tree: {
        emptyText: 'ရလဒ်မရှိပါ',
        searchPlaceholder: 'ရှာဖွေပါ',
    },
    List: {
        emptyText: 'ရလဒ်မရှိပါ',
    },
    Calendar: {
        allDay: 'တစ်နေ့လုံး',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: 'နောက်ထပ် ${remained} ခု',
    },
    Upload: {
        mainText: 'ဖိုင် အပ်လုဒ်တင်ရန် ကလစ်နှိပ်ပါ သို့မဟုတ် ဖိုင်ကို ဤနေရာသို့ ဆွဲယူပါ',
        illegalTips: 'ဤဖိုင်အမျိုးအစားကို မပံ့ပိုးပေးပါ',
        legalTips: 'လက်လွှတ်ပြီး အပ်လုဒ်တင်ခြင်းကို စတင်ပါ',
        retry: 'ပြန်လုပ်မည်',
        replace: 'ဖိုင်ကို အစားထိုးမည်',
        clear: 'ရှင်းမည်',
        selectedFiles: 'ရွေးချယ်ထားသော ဖိုင်များ',
        illegalSize: 'ခွင့်မပြုသော ဖိုင်အရွယ်အစား',
        fail: 'အပ်လုဒ်တင်ခြင်း မအောင်မြင်ပါ',
    },
    TreeSelect: {
        searchPlaceholder: 'ရှာဖွေပါ',
    },
    Typography: {
        copy: 'ကူးယူမည်',
        copied: 'ကူးယူပြီးပါပြီ',
        expand: 'ချဲ့ရန်',
        collapse: 'ချုံ့ရန်',
    },
    Transfer: {
        emptyLeft: 'ဒေတာ မရှိပါ',
        emptySearch: 'ရှာဖွေမှုရလဒ်များ မရှိပါ',
        emptyRight: 'အကြောင်းအရာမရှိပါ၊ ဘယ်ဘက်အခြမ်းမှ ရွေးချယ်ပါ',
        placeholder: 'ရှာဖွေပါ',
        clear: 'ရှင်းမည်',
        selectAll: 'အားလုံး ရွေးချယ်မည်',
        clearSelectAll: 'အားလုံးကို ရွေးချယ်မှု ဖြုတ်မည်',
        total: 'ပစ္စည်း စုစုပေါင်း- ${total}',
        selected: 'ရွေးချယ်ထားသော ပစ္စည်းများ- ${total}',
    },
    Form: {
        optional: '(ဆန္ဒရှိလျှင် ထည့်ရန်)',
    },
    Image: {
        preview: 'နမူနာမြင်ကွင်း',
        loading: 'လုပ်ဆောင်နေဆဲ',
        loadError: 'ဖွင့်၍ မရပါ',
        prevTip: 'နောက်သို့',
        nextTip: 'ရှေ့သို့',
        zoomInTip: 'ဇူးမ်ချဲ့',
        zoomOutTip: 'ဇူးမ်ချုံ့',
        rotateTip: 'လှည့်ရန်',
        downloadTip: 'ဒေါင်းလုဒ်လုပ်ရန်',
        adaptiveTip: 'စာမျက်နှာနှင့် အလိုက်သင့်ပြင်ဆင်ရန်',
        originTip: 'မူလအရွယ်အစား',
    },
    Chat: {
        deleteConfirm: 'ဤကဏ္ဍကို ဖျက်လိုသည်မှာ သေချာပါသလား။',
        clearContext: 'ဆက်စပ်အကြောင်းအရာကို ရှင်းလင်းပြီးပါပြီ',
        copySuccess: 'ကူးယူခြင်း အောင်မြင်သည်။',
        stop: 'ရပ်မည်',
        copy: 'ကူးယူမည်',
        copied: 'ကူးယူပြီးပါပြီ',
        dropAreaText: 'ဖိုင်ကို ဤနေရာတွင် ထည့်သွင်းပါ',
    },
    UserGuide: {
        skip: 'ကျော်မည်',
        next: 'ရှေ့သို့',
        prev: 'နောက်သို့',
        finish: 'အပြီးသတ်မည်',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'ရှာဖွေပါ',
        replace: 'အစားထိုးမည်',
        replaceAll: 'အားလုံးကို အစားထိုးမည်',
    },
    VideoPlayer: {
        rateChange: 'နှုန်းကို ${rate} သို့ ပြောင်းမည်',
        qualityChange: 'အရည်အသွေးကို ${quality} သို့ ပြောင်းမည်',
        routeChange: 'လမ်းကြောင်းကို ${route} သို့ ပြောင်းမည်',
        mirror: 'မှန်မုဒ်',
        cancelMirror: 'မှန်မုဒ်ကို ပယ်ဖျက်မည်',
        loading: 'လုပ်ဆောင်နေဆဲ...',
        stall: 'ဖွင့်၍ မရပါ',
        noResource: 'ရင်းမြစ်မရှိပါ',
        videoError: 'ဗီဒီယိုဖွင့်ခြင်းဆိုင်ရာ ချွတ်ယွင်းမှု',
    },
    AIChatDialogue: {
        delete: 'ဖျက်မည်',
        deleteConfirm: 'ဤမက်ဆေ့ချ်ကို ဖျက်လိုသည်မှာ သေချာပါသလား။',
        deleteContent: 'ဤမက်ဆေ့ချ်ကို အပြီးတိုင် ဖျက်မည်ဖြစ်ပြီး ပြန်လည်မရယူနိုင်ပါ။',
        copySuccess: 'ကူးယူမှု အောင်မြင်သည်',
        loading: 'လုပ်ဆောင်နေဆဲ...',
        reasoning: {
            completed: 'ဆင်ခြင်သုံးသပ်ပြီးပါပြီ',
            thinking: 'စဉ်းစားနေသည်...'
        },
        annotationText: 'အချက်အလက် အရေအတွက်'
    },
    Feedback: {
        submit: '‌ပေးပို့မည်',
        cancel: 'ပယ်ဖျက်မည်'
    },
    AIChatInput: {
        template: 'နမူနာပုံစံ',
        configure: 'စီစဉ်သတ်မှတ်ရန်',
        selected: 'ပစ္စည်း ${count} ခု ရွေးချယ်ထားသည်',
    }
};

export default local;