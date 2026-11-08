import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Control Panel': 'Control Panel',
    'Live data, refreshed every 3 seconds':
      'Live data, refreshed every 3 seconds',
    'Client Balances': 'Client Balances',
    'Remaining balance and usage of each client':
      'Remaining balance and usage of each client',
    'Highest balance': 'Highest balance',
    'Lowest balance': 'Lowest balance',
    'Recently active': 'Recently active',
    'View all clients': 'View all clients',
    'Total clients': 'Total clients',
    'Unauthorized, only the root account can use internal network upstreams':
      'Unauthorized, only the root account can use internal network upstreams',
  },
  zh: {
    'Control Panel': '控制台',
    'Live data, refreshed every 3 seconds': '实时数据，每 3 秒自动刷新',
    'Client Balances': '客户余额',
    'Remaining balance and usage of each client': '每位客户的剩余余额与用量',
    'Highest balance': '余额最高',
    'Lowest balance': '余额最低',
    'Recently active': '最近活跃',
    'View all clients': '查看全部客户',
    'Total clients': '客户总数',
    'Unauthorized, only the root account can use internal network upstreams':
      '无权进行此操作，只有超级管理员可以使用内网上游',
  },
  'zh-TW': {
    'Control Panel': '控制台',
    'Live data, refreshed every 3 seconds': '即時資料，每 3 秒自動重新整理',
    'Client Balances': '客戶餘額',
    'Remaining balance and usage of each client': '每位客戶的剩餘餘額與用量',
    'Highest balance': '餘額最高',
    'Lowest balance': '餘額最低',
    'Recently active': '最近活躍',
    'View all clients': '檢視全部客戶',
    'Total clients': '客戶總數',
    'Unauthorized, only the root account can use internal network upstreams':
      '無權進行此操作，只有超級管理員可以使用內網上游',
  },
  fr: {
    'Control Panel': 'Panneau de contrôle',
    'Live data, refreshed every 3 seconds':
      'Données en direct, actualisées toutes les 3 secondes',
    'Client Balances': 'Soldes des clients',
    'Remaining balance and usage of each client':
      'Solde restant et consommation de chaque client',
    'Highest balance': 'Solde le plus élevé',
    'Lowest balance': 'Solde le plus bas',
    'Recently active': 'Récemment actif',
    'View all clients': 'Voir tous les clients',
    'Total clients': 'Total des clients',
    'Unauthorized, only the root account can use internal network upstreams':
      'Non autorisé, seul le super administrateur peut utiliser des serveurs internes',
  },
  ja: {
    'Control Panel': 'コントロールパネル',
    'Live data, refreshed every 3 seconds': 'リアルタイムデータ、3秒ごとに自動更新',
    'Client Balances': '顧客残高',
    'Remaining balance and usage of each client': '各顧客の残高と使用量',
    'Highest balance': '残高が多い順',
    'Lowest balance': '残高が少ない順',
    'Recently active': '最近のアクティブ',
    'View all clients': 'すべての顧客を表示',
    'Total clients': '顧客総数',
    'Unauthorized, only the root account can use internal network upstreams':
      '権限不足のため、この操作は実行できません。内部ネットワークの宛先はスーパー管理者のみ利用できます',
  },
  ru: {
    'Control Panel': 'Панель управления',
    'Live data, refreshed every 3 seconds':
      'Данные в реальном времени, обновление каждые 3 секунды',
    'Client Balances': 'Балансы клиентов',
    'Remaining balance and usage of each client':
      'Остаток баланса и потребление каждого клиента',
    'Highest balance': 'Наибольший баланс',
    'Lowest balance': 'Наименьший баланс',
    'Recently active': 'Недавно активные',
    'View all clients': 'Все клиенты',
    'Total clients': 'Всего клиентов',
    'Unauthorized, only the root account can use internal network upstreams':
      'Нет доступа, использовать внутренние серверы может только суперадминистратор',
  },
  vi: {
    'Control Panel': 'Bảng điều khiển',
    'Live data, refreshed every 3 seconds': 'Dữ liệu trực tiếp, cập nhật mỗi 3 giây',
    'Client Balances': 'Số dư khách hàng',
    'Remaining balance and usage of each client':
      'Số dư còn lại và mức sử dụng của từng khách hàng',
    'Highest balance': 'Số dư cao nhất',
    'Lowest balance': 'Số dư thấp nhất',
    'Recently active': 'Hoạt động gần đây',
    'View all clients': 'Xem tất cả khách hàng',
    'Total clients': 'Tổng số khách hàng',
    'Unauthorized, only the root account can use internal network upstreams':
      'Không được phép, chỉ siêu quản trị viên mới có thể dùng máy chủ trong mạng nội bộ',
  },
  ar: {
    'Control Panel': 'لوحة التحكم',
    'Live data, refreshed every 3 seconds': 'بيانات مباشرة، تحديث تلقائي كل 3 ثوانٍ',
    'Client Balances': 'أرصدة العملاء',
    'Remaining balance and usage of each client': 'الرصيد المتبقي واستخدام كل عميل',
    'Highest balance': 'الأعلى رصيدًا',
    'Lowest balance': 'الأدنى رصيدًا',
    'Recently active': 'الأحدث نشاطًا',
    'View all clients': 'عرض جميع العملاء',
    'Total clients': 'إجمالي العملاء',
    'Unauthorized, only the root account can use internal network upstreams':
      'غير مصرّح، لا يمكن استخدام الخوادم داخل الشبكة الداخلية إلا من قبل المسؤول الأعلى',
  },
}

async function main() {
  let totalAdded = 0

  for (const [locale, trans] of Object.entries(newKeys)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    const json = JSON.parse(await fs.readFile(filePath, 'utf8'))

    let count = 0
    for (const [key, value] of Object.entries(trans)) {
      if (!Object.prototype.hasOwnProperty.call(json.translation, key)) {
        json.translation[key] = value
        count++
      } else if (json.translation[key] !== value) {
        json.translation[key] = value
        count++
      }
    }

    if (count > 0) {
      json.translation = Object.fromEntries(
        Object.entries(json.translation).sort(([a], [b]) => a.localeCompare(b))
      )
      await fs.writeFile(filePath, stableStringify(json), 'utf8')
    }

    console.log(`${locale}: ${count} translations applied`)
    totalAdded += count
  }

  console.log(`\nTotal: ${totalAdded} translations applied`)
}

main().catch((err) => { console.error(err); process.exitCode = 1 })
