/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Usage Leaderboard': 'Usage Leaderboard',
    'See who is leading the platform by usage and daily check-in rewards. Administrators are excluded.':
      'See who is leading the platform by usage and daily check-in rewards. Administrators are excluded.',
    'No leaderboard data yet — be the first to claim a spot.':
      'No leaderboard data yet — be the first to claim a spot.',
    Anonymous: 'Anonymous',
    '1st': '1st',
    '2nd': '2nd',
    '3rd': '3rd',
    You: 'You',
    'Unable to load leaderboard data': 'Unable to load leaderboard data',
    'Unable to load leaderboard': 'Unable to load leaderboard',
    '{{count}} requests': '{{count}} requests',
    'Check-in reward': 'Check-in reward',
    'Check-in leaderboard for {{date}}': 'Check-in leaderboard for {{date}}',
    'Cached — refreshes every couple of minutes.':
      'Cached — refreshes every couple of minutes.',
    'Usage leaderboard with daily check-in rankings. Requires login.':
      'Usage leaderboard with daily check-in rankings. Requires login.',
  },
  zh: {
    'Usage Leaderboard': '用量排行榜',
    'See who is leading the platform by usage and daily check-in rewards. Administrators are excluded.':
      '查看谁在用量和每日签到奖励上领先平台。管理员不参与排名。',
    'No leaderboard data yet — be the first to claim a spot.':
      '暂无排行榜数据 — 成为第一个上榜的人。',
    Anonymous: '匿名',
    '1st': '第1',
    '2nd': '第2',
    '3rd': '第3',
    You: '你',
    'Unable to load leaderboard data': '无法加载排行榜数据',
    'Unable to load leaderboard': '无法加载排行榜',
    '{{count}} requests': '{{count}} 次请求',
    'Check-in reward': '签到奖励',
    'Check-in leaderboard for {{date}}': '{{date}} 签到排行榜',
    'Cached — refreshes every couple of minutes.':
      '已缓存 — 每隔几分钟刷新。',
    'Usage leaderboard with daily check-in rankings. Requires login.':
      '用量排行榜与每日签到排名。需要登录。',
  },
  'zh-TW': {
    'Usage Leaderboard': '用量排行榜',
    'See who is leading the platform by usage and daily check-in rewards. Administrators are excluded.':
      '查看誰在用量和每日簽到獎勵上領先平台。管理員不參與排名。',
    'No leaderboard data yet — be the first to claim a spot.':
      '暫無排行榜資料 — 成為第一個上榜的人。',
    Anonymous: '匿名',
    '1st': '第1',
    '2nd': '第2',
    '3rd': '第3',
    You: '你',
    'Unable to load leaderboard data': '無法載入排行榜資料',
    'Unable to load leaderboard': '無法載入排行榜',
    '{{count}} requests': '{{count}} 次請求',
    'Check-in reward': '簽到獎勵',
    'Check-in leaderboard for {{date}}': '{{date}} 簽到排行榜',
    'Cached — refreshes every couple of minutes.':
      '已快取 — 每隔幾分鐘重新整理。',
    'Usage leaderboard with daily check-in rankings. Requires login.':
      '用量排行榜與每日簽到排名。需要登入。',
  },
  fr: {
    'Usage Leaderboard': "Classement d'utilisation",
    'See who is leading the platform by usage and daily check-in rewards. Administrators are excluded.':
      "Voyez qui mène la plateforme par l'utilisation et les récompenses de connexion quotidiennes. Les administrateurs sont exclus.",
    'No leaderboard data yet — be the first to claim a spot.':
      'Pas encore de données de classement — soyez le premier à prendre une place.',
    Anonymous: 'Anonyme',
    '1st': '1er',
    '2nd': '2e',
    '3rd': '3e',
    You: 'Vous',
    'Unable to load leaderboard data':
      'Impossible de charger les données du classement',
    'Unable to load leaderboard': 'Impossible de charger le classement',
    '{{count}} requests': '{{count}} requêtes',
    'Check-in reward': 'Récompense de connexion',
    'Check-in leaderboard for {{date}}':
      'Classement des connexions pour le {{date}}',
    'Cached — refreshes every couple of minutes.':
      'En cache — actualisé toutes les quelques minutes.',
    'Usage leaderboard with daily check-in rankings. Requires login.':
      "Classement d'utilisation avec classements de connexion quotidiens. Connexion requise.",
  },
  ja: {
    'Usage Leaderboard': '使用量ランキング',
    'See who is leading the platform by usage and daily check-in rewards. Administrators are excluded.':
      '使用量とデイリーチェックイン報酬でプラットフォームをリードしているユーザーを確認。管理者は除外されます。',
    'No leaderboard data yet — be the first to claim a spot.':
      'まだランキングデータがありません — 最初にランクインしましょう。',
    Anonymous: '匿名',
    '1st': '1位',
    '2nd': '2位',
    '3rd': '3位',
    You: 'あなた',
    'Unable to load leaderboard data': 'ランキングデータを読み込めません',
    'Unable to load leaderboard': 'ランキングを読み込めません',
    '{{count}} requests': '{{count}} リクエスト',
    'Check-in reward': 'チェックイン報酬',
    'Check-in leaderboard for {{date}}': '{{date}} のチェックインランキング',
    'Cached — refreshes every couple of minutes.':
      'キャッシュ済み — 数分ごとに更新されます。',
    'Usage leaderboard with daily check-in rankings. Requires login.':
      '使用量ランキングとデイリーチェックイン順位。ログインが必要です。',
  },
  ru: {
    'Usage Leaderboard': 'Таблица лидеров по использованию',
    'See who is leading the platform by usage and daily check-in rewards. Administrators are excluded.':
      'Узнайте, кто лидирует на платформе по использованию и ежедневным наградам за отметку. Администраторы исключены.',
    'No leaderboard data yet — be the first to claim a spot.':
      'Данных таблицы лидеров пока нет — станьте первым.',
    Anonymous: 'Аноним',
    '1st': '1-е',
    '2nd': '2-е',
    '3rd': '3-е',
    You: 'Вы',
    'Unable to load leaderboard data':
      'Не удалось загрузить данные таблицы лидеров',
    'Unable to load leaderboard': 'Не удалось загрузить таблицу лидеров',
    '{{count}} requests': '{{count}} запросов',
    'Check-in reward': 'Награда за отметку',
    'Check-in leaderboard for {{date}}':
      'Таблица лидеров по отметкам за {{date}}',
    'Cached — refreshes every couple of minutes.':
      'Кэшировано — обновляется каждые пару минут.',
    'Usage leaderboard with daily check-in rankings. Requires login.':
      'Таблица лидеров по использованию с ежедневными отметками. Требуется вход.',
  },
  vi: {
    'Usage Leaderboard': 'Bảng xếp hạng mức sử dụng',
    'See who is leading the platform by usage and daily check-in rewards. Administrators are excluded.':
      'Xem ai đang dẫn đầu nền tảng theo mức sử dụng và phần thưởng đăng nhập hàng ngày. Quản trị viên bị loại trừ.',
    'No leaderboard data yet — be the first to claim a spot.':
      'Chưa có dữ liệu bảng xếp hạng — hãy là người đầu tiên giành chỗ.',
    Anonymous: 'Ẩn danh',
    '1st': 'Hạng 1',
    '2nd': 'Hạng 2',
    '3rd': 'Hạng 3',
    You: 'Bạn',
    'Unable to load leaderboard data':
      'Không thể tải dữ liệu bảng xếp hạng',
    'Unable to load leaderboard': 'Không thể tải bảng xếp hạng',
    '{{count}} requests': '{{count}} yêu cầu',
    'Check-in reward': 'Phần thưởng đăng nhập',
    'Check-in leaderboard for {{date}}':
      'Bảng xếp hạng đăng nhập cho {{date}}',
    'Cached — refreshes every couple of minutes.':
      'Đã lưu cache — làm mới mỗi vài phút.',
    'Usage leaderboard with daily check-in rankings. Requires login.':
      'Bảng xếp hạng mức sử dụng với xếp hạng đăng nhập hàng ngày. Cần đăng nhập.',
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
        Object.entries(json.translation).sort(([a], [b]) =>
          a.localeCompare(b)
        )
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
