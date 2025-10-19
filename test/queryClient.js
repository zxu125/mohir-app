import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    let statuses = await prisma.orderStatus.findMany()
    console.log('statuses', statuses.map(e => {
        return { id: e.id, status: e.status, color: '', textColor: '' }
    }))
}

main()