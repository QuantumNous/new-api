import { test as setup } from '@playwright/test'

import { PrismaClient } from '@prisma/client'

const prismaClient = new PrismaClient()

setup('create new database', async () => {
  if (
    await prismaClient.user.findUnique({
      where: {
        email: 'test2@gmail.com',
      },
    })
  ) {
    await prismaClient.user.delete({
      where: {
        email: 'test2@gmail.com',
      },
    })
  }
})
