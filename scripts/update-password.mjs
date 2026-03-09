import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const email = 'adrianodevequi@gmail.com';
const newPassword = '@Luk32575';

const hash = await bcrypt.hash(newPassword, 10);

const result = await prisma.user.update({
  where: { email },
  data: { password: hash },
});

console.log('Senha atualizada para:', result.email);
await prisma.$disconnect();
