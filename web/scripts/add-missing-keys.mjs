import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Failed requests': 'Failed requests',
    'Failed requests in the last 24 hours':
      'Failed requests in the last 24 hours',
    'Top failing models': 'Top failing models',
    'No failed requests in the last 24 hours':
      'No failed requests in the last 24 hours',
  },
  zh: {
    'Failed requests': '失败请求',
    'Failed requests in the last 24 hours': '最近 24 小时的失败请求',
    'Top failing models': '失败最多的模型',
    'No failed requests in the last 24 hours': '最近 24 小时没有失败请求',
  },
  'zh-TW': {
    'Failed requests': '失敗請求',
    'Failed requests in the last 24 hours': '最近 24 小時的失敗請求',
    'Top failing models': '失敗最多的模型',
    'No failed requests in the last 24 hours': '最近 24 小時沒有失敗請求',
  },
  fr: {
    'Failed requests': 'Requêtes échouées',
    'Failed requests in the last 24 hours':
      'Requêtes échouées au cours des 24 dernières heures',
    'Top failing models': 'Modèles les plus en échec',
    'No failed requests in the last 24 hours':
      'Aucune requête échouée au cours des 24 dernières heures',
  },
  ja: {
    'Failed requests': '失敗リクエスト',
    'Failed requests in the last 24 hours': '直近24時間の失敗リクエスト',
    'Top failing models': '失敗の多いモデル',
    'No failed requests in the last 24 hours':
      '直近24時間の失敗リクエストはありません',
  },
  ru: {
    'Failed requests': 'Неудачные запросы',
    'Failed requests in the last 24 hours':
      'Неудачные запросы за последние 24 часа',
    'Top failing models': 'Модели с наибольшими сбоями',
    'No failed requests in the last 24 hours':
      'За последние 24 часа нет неудачных запросов',
  },
  vi: {
    'Failed requests': 'Yêu cầu thất bại',
    'Failed requests in the last 24 hours':
      'Yêu cầu thất bại trong 24 giờ qua',
    'Top failing models': 'Model thất bại nhiều nhất',
    'No failed requests in the last 24 hours':
      'Không có yêu cầu thất bại nào trong 24 giờ qua',
  },
  ar: {
    'Failed requests': 'طلبات فاشلة',
    'Failed requests in the last 24 hours': 'طلبات فاشلة خلال آخر 24 ساعة',
    'Top failing models': 'النماذج الأكثر فشلاً',
    'No failed requests in the last 24 hours':
      'لا توجد طلبات فاشلة خلال آخر 24 ساعة',
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

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
