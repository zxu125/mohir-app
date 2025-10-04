import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Connect the client
    await prisma.$connect();

    let locations = await prisma.location.createMany({
        data: [
            { latitude: 111, longtitude: 222, },
            { latitude: 333, longtitude: 444, }
        ]
    });
}
main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });