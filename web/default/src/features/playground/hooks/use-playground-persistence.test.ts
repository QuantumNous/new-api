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
import i18next from '@/i18n/config'
import { expect, test } from 'bun:test'
import {
  runUserScopedDrain,
  translatePlaygroundPersistenceWarning,
} from './use-playground-persistence'

const persistenceWarnings = {
  en: {
    restore:
      'Could not read saved Playground retries; keeping the local conversation.',
    volatile:
      'This Playground record could not be stored in the browser. Keep this page open while it retries.',
  },
  es: {
    restore:
      'No se pudieron leer los reintentos guardados de Playground; se conservará la conversación local.',
    volatile:
      'Este registro de Playground no se pudo guardar en el navegador. Mantén esta página abierta mientras se reintenta.',
  },
  fr: {
    restore:
      'Impossible de lire les tentatives enregistrées du Playground ; la conversation locale sera conservée.',
    volatile:
      'Cet enregistrement Playground n’a pas pu être stocké dans le navigateur. Gardez cette page ouverte pendant les nouvelles tentatives.',
  },
  ja: {
    restore:
      '保存された Playground の再試行データを読み込めませんでした。ローカルの会話を保持します。',
    volatile:
      'この Playground レコードをブラウザに保存できませんでした。再試行中はこのページを開いたままにしてください。',
  },
  pt: {
    restore:
      'Não foi possível ler as tentativas salvas do Playground; a conversa local será mantida.',
    volatile:
      'Este registro do Playground não pôde ser salvo no navegador. Mantenha esta página aberta enquanto novas tentativas são feitas.',
  },
  ru: {
    restore:
      'Не удалось прочитать сохранённые повторные попытки Playground; локальный диалог будет сохранён.',
    volatile:
      'Не удалось сохранить эту запись Playground в браузере. Не закрывайте страницу, пока выполняются повторные попытки.',
  },
  vi: {
    restore:
      'Không thể đọc các lần thử lại Playground đã lưu; cuộc trò chuyện cục bộ sẽ được giữ lại.',
    volatile:
      'Không thể lưu bản ghi Playground này trong trình duyệt. Hãy giữ trang này mở trong khi hệ thống thử lại.',
  },
  zh: {
    restore: '无法读取已保存的 Playground 重试记录；将保留本地对话。',
    volatile:
      '此 Playground 记录无法保存在浏览器中。请保持此页面打开，系统将继续重试。',
  },
} as const

test('localizes Playground persistence warnings in every supported language', async () => {
  const originalLanguage = i18next.language

  try {
    for (const [locale, expected] of Object.entries(persistenceWarnings)) {
      await i18next.changeLanguage(locale)
      expect(translatePlaygroundPersistenceWarning('restore')).toBe(
        expected.restore
      )
      expect(translatePlaygroundPersistenceWarning('volatile')).toBe(
        expected.volatile
      )
    }
  } finally {
    await i18next.changeLanguage(originalLanguage)
  }
})

test('drains different users independently while deduplicating the same user', async () => {
  const inFlight = new Map<number, Promise<string>>()
  const calls: number[] = []
  let finishFirst: ((value: string) => void) | undefined

  const first = runUserScopedDrain(inFlight, 10, () => {
    calls.push(10)
    return new Promise<string>((resolve) => {
      finishFirst = resolve
    })
  })
  const duplicateFirst = runUserScopedDrain(inFlight, 10, async () => {
    calls.push(10)
    return 'duplicate'
  })
  const second = runUserScopedDrain(inFlight, 20, async () => {
    calls.push(20)
    return 'second'
  })

  expect(duplicateFirst).toBe(first)
  expect(await second).toBe('second')
  expect(calls).toEqual([10, 20])

  finishFirst?.('first')
  expect(await first).toBe('first')
  expect(inFlight.size).toBe(0)
})
