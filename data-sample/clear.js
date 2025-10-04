
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Clearing database...");

    // Delete all records from the tables in the correct order to avoid foreign key constraint issues
    await prisma.clientLocation.deleteMany();
    await prisma.stock.deleteMany();
    await prisma.delivery.deleteMany();
    await prisma.clientLocation.deleteMany();
    await prisma.stock.deleteMany();
    await prisma.location.deleteMany();
    await prisma.client.deleteMany();

    console.log("✅ Database cleared!");
}

if(process.argv[1].includes("clear.js")) {
    main()
        .catch((e) => {
            console.error(e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}

export default main;