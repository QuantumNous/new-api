import { th } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'th-TH',
    dateFnsLocale: th,
    currency: 'THB',
    Pagination: {
        pageSize: 'รายการต่อหน้า: ${pageSize}',
        total: 'หน้าทั้งหมด: ${total}',
        jumpTo: 'ข้ามไปที่',
        page: 'หน้า',
    },
    Modal: {
        confirm: 'ตกลง',
        cancel: 'ยกเลิก',
    },
    Tabs: {
        more: "มากกว่า"
    },
    TimePicker: {
        placeholder: {
            time: 'โปรดเลือกเวลา',
            timeRange: 'โปรดเลือกช่วงเวลา',
        },
        begin: 'เวลาเริ่มต้น',
        end: 'เวลาสิ้นสุด',
        // hour: 'เวลา',
        // minute: 'นาที',
        // second: 'วินาที',
        hour: '',
        minute: '',
        second: '',
        AM: 'ตอนเช้า',
        PM: 'ในช่วงบ่าย',
    },
    DatePicker: {
        placeholder: {
            date: 'โปรดเลือกวันที่',
            dateTime: 'โปรดเลือกวันที่และเวลา',
            dateRange: ['วันที่เริ่มต้น', 'วันที่สิ้นสุด'],
            dateTimeRange: ['วันที่เริ่มต้น', 'วันที่สิ้นสุด'],
            monthRange: ['เดือนเริ่มต้น', 'เดือนสิ้นสุด'],
        },
        presets: 'การเลือกด่วน',
        footer: {
            confirm: 'ตกลง',
            cancel: 'ยกเลิก',
        },
        selectDate: 'กลับไปยังวันที่ที่เลือก',
        selectTime: 'ช่วงเวลาการคัดเลือก',
        year: 'ปี',
        month: 'เดือน',
        day: 'วัน',
        monthText: '${year}ปี ${month}', // 此处不使用标准token是因为需要做replace，月份M这个Token可能会被误伤，例如May
        months: {
            1: 'มกราคม',
            2: 'กุมภาพันธ์',
            3: 'มีนาคม',
            4: 'เมษายน',
            5: 'อาจ',
            6: 'มิถุนายน',
            7: 'กรกฎาคม',
            8: 'สิงหาคม',
            9: 'กันยายน',
            10: 'ตุลาคม',
            11: 'ตุลาคม',
            12: 'ตุลาคม',
        },
        // timepicker scrollwheel里只需要展示[1、2……]，所以这里的fullMonths根据UI定制了
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
            12: '12',
        },
        weeks: {
            Mon: 'จันทร์',
            Tue: 'อ.',
            Wed: 'พ.',
            Thu: 'พฤ.',
            Fri: 'ศ.',
            Sat: 'ส.',
            Sun: 'อา',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/MM/yyyy',
        },
    },
    Navigation: {
        collapseText: 'ยุบแถบด้านข้าง',
        expandText: 'ขยายแถบด้านข้าง',
    },
    Popconfirm: {
        confirm: 'กำหนด',
        cancel: 'ยกเลิก',
    },
    Table: {
        emptyText: 'ไม่มีข้อมูล',
        pageText: 'แสดงรายการ ${currentStart} - ${currentEnd} จาก ${total}',
        descend: 'คลิกเพื่อเรียงจากมากไปหาน้อย',
        ascend: 'คลิกเพื่อเรียงจากน้อยไปหามาก',
        cancelSort: 'ยกเลิกการเรียงลำดับ',
    },
    Select: {
        emptyText: 'ไม่มีข้อมูล',
        createText: 'สร้าง',
    },
    Cascader: {
        emptyText: 'ไม่มีข้อมูล',
    },
    Tree: {
        emptyText: 'ไม่มีข้อมูล',
        searchPlaceholder: 'ค้นหา',
    },
    List: {
        emptyText: 'ไม่มีข้อมูล',
    },
    Calendar: {
        allDay: 'ทั้งวัน',
        AM: '${time} ในตอนเช้า',
        PM: 'ตอนบ่ายที่ ${time}',
        datestring: 'วัน',
        remaining: 'มีอีก ${remained} รายการ',
    },
    Upload: {
        mainText: 'คลิกเพื่ออัปโหลดไฟล์หรือลากและวางไฟล์ที่นี่',
        illegalTips: 'ไม่รองรับไฟล์ประเภทนี้',
        legalTips: 'ปล่อยและเริ่มอัปโหลด',
        retry: 'ลองใหม่',
        replace: 'แทนที่ไฟล์',
        clear: 'ว่าง',
        selectedFiles: 'ไฟล์ที่เลือก',
        illegalSize: 'ขนาดไฟล์ผิดกฎหมาย',
        fail: 'การอัพโหลดล้มเหลว',
    },
    TreeSelect: {
        searchPlaceholder: 'ค้นหา',
    },
    Typography: {
        copy: 'สำเนา"',
        copied: 'คัดลอกสำเร็จ',
        expand: 'ขยาย',
        collapse: 'ยุบ',
    },
    Transfer: {
        emptyLeft: 'ไม่มีข้อมูล',
        emptySearch: 'ไม่มีผลการค้นหา',
        emptyRight: 'ยังไม่มีเนื้อหาคุณสามารถเลือกจากด้านซ้าย',
        placeholder: 'ค้นหา',
        clear: 'ว่าง',
        selectAll: 'เลือกทั้งหมด',
        clearSelectAll: 'ยกเลิกการเลือกทั้งหมด',
        total: 'รายการทั้งหมด: ${total}',
        selected: 'รายการที่เลือก: ${total}',
    },
    Form: {
        optional: '(ไม่จำเป็น)',
    },
    Image: {
        preview: 'ดูตัวอย่าง',
        loading: 'กำลังโหลด',
        loadError: 'โหลดไม่สำเร็จ',
        prevTip: 'ก่อนหน้า',
        nextTip: 'ถัดไป',
        zoomInTip: 'ซูมเข้า',
        zoomOutTip: 'ซูมออก',
        rotateTip: 'หมุน',
        downloadTip: 'ดาวน์โหลด',
        adaptiveTip: 'ปรับให้เข้ากับหน้า',
        originTip: 'ขนาดเดิม',
    },
    Chat: {
        deleteConfirm: 'คุณต้องการลบการสนทนานี้ใช่หรือไม่?',
        clearContext: 'ล้างความเข้าใจเรียบร้อยแล้ว',
        copySuccess: 'คัดลอกสำเร็จ',
        stop: 'หยุด',
        copy: 'สำเนา"',
        copied: 'คัดลอกสำเร็จ',
        dropAreaText: 'วางไฟล์ที่นี่',
    },
    UserGuide: {
        skip: 'ข้าม',
        next: 'ถัดไป',
        prev: 'ก่อนหน้า',
        finish: 'สำเร็จ',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'ค้นหา',
        replace: 'แทนที่',
        replaceAll: 'แทนที่ทั้งหมด',
    },
    VideoPlayer: {
        rateChange: 'เปลี่ยนความเร็วเป็น ${rate}',
        qualityChange: 'เปลี่ยนคุณภาพเป็น ${quality}',
        routeChange: 'เปลี่ยนเส้นทางเป็น ${route}',
        mirror: 'กลับหน้า',
        cancelMirror: 'ยกเลิกกลับหน้า',
        loading: 'กำลังโหลด...',
        stall: 'กำลังโหลดล้มเหลว',
        noResource: 'ไม่มีทรัพยากร',
        videoError: 'เกิดข้อผิดพลาดในการโหลดวิดีโอ'
    },
    AIChatDialogue: {
        delete: 'ลบ',
        deleteConfirm: 'คุณต้องการลบการสนทนานี้ใช่หรอไม่?',
        deleteContent: 'การสนทนานี้จะลบออกอย่างถาวรและไม่สามารถกู้คืนได้',
        copySuccess: 'คัดลอกสำเร็จ',
        loading: 'กำลังโหลด...',
        reasoning: {
            completed: 'การคิดค้นสำเร็จ',
            thinking: 'กำลังคิดค้น...'
        },
        annotationText: 'องค์ประกอบของข้อมูล'
    },
    Feedback: {
        submit: 'ส่ง',
        cancel: 'ยกเลิก'
    },
    AIChatInput: {
        template: 'ลายฉลุ',
        configure: 'การกำหนดค่า',
        selected: '${count} รายการที่เลือก',
    }
};

// [i18n-Thai]
export default local;
