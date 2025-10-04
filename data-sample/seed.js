
import { PrismaClient } from "@prisma/client";
import { clients } from "./seedData.js";
import { randomTashkentLocation } from "./utils.js";
import clear from "./clear.js";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding database...");
    await clear()
    for (const clientData of clients) {
        // Create client
        const client = await prisma.client.create({
            data: {
                name: clientData.name,
                email: clientData.email,
                phone: clientData.phone,
            },
        });

        // Create location for client
        const loc = randomTashkentLocation();
        const location = await prisma.location.create({
            data: {
                latitude: loc.latitude,
                longtitude: loc.longtitude,
            },
        });

        // Link client to location
        await prisma.clientLocation.create({
            data: {
                clientId: client.id,
                locationId: location.id,
            },
        });

        // Create stock entry (product id = 1, random bottles)
        await prisma.stock.create({
            data: {
                clientId: client.id,
                productId: 1,
                quantity: Math.floor(Math.random() * 50) + 5, // 5–55 bottles
                locationId: location.id,
            },
        });
        console.log("✅ Seeding complete!");
    }

    const orderCount = Math.floor(Math.random() * 4) + 2;

    for (let i = 0; i < orderCount; i++) {
        const statusId = Math.floor(Math.random() * 5) + 1; // 1–5
        const totalAmount = Math.floor(Math.random() * 200000) + 20000; // 20k – 220k sums
        const client = await prisma.client.findFirst({
            skip: Math.floor(Math.random() * clients.length),
            include: { locations: { include: { location: true } } },
        });
        await prisma.order.create({
            data: {
                clientId: client.id,
                locationId: client.locations[0].location.id, // inherit client’s location
                statusId,
                totalAmount,
                orderDate: new Date(
                    Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000 // within last 30 days
                ),
            },
        });
    }
}
main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

