import crypto from 'node:crypto'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '../prisma-generated/client'

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
})
export const prismaClient = new PrismaClient({ adapter })

export function hashPassword(password: string) {
  return new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(password, 'salt', 100000, 64, 'sha256', (err, derivedKey) => {
      if (err) {
        reject(err)
      } else {
        resolve(derivedKey.toString('hex'))
      }
    })
  })
}
