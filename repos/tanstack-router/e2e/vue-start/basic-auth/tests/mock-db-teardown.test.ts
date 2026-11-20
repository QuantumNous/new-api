import { test as teardown } from '@playwright/test'

import { hashPassword, prismaClient } from '../src/utils/prisma'

teardown('create new database', async () => {
  await prismaClient.user.deleteMany()

  const email = 'test@gmail.com'
  const password = await hashPassword('test')
  await prismaClient.user.create({
    data: {
      email,
      password,
    },
  })
})
