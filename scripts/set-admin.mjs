import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'adrianodevequi@gmail.com'

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    console.log(`User with email ${email} not found.`)
    return
  }

  const updatedUser = await prisma.user.update({
    where: { email },
    data: {
      isSuperAdmin: true,
    },
  })

  console.log(`Successfully updated ${email} to Super Admin (isSuperAdmin: ${updatedUser.isSuperAdmin})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
