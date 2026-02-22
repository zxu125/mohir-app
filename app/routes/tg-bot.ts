import express from "express";
import prisma from "../prismacl.js";
const router = express.Router();

router.post("/newclient", async (req, res) => {
    const { name, phone, location } = req.body;
    if (!name || !location || !location.latitude || !location.longitude) {
        return res.status(400).json({ message: "name, phone and regionId required" });
    }
    try {
        const existing = await prisma.client.findFirst({
            where: { name }
        });
        if (existing) {
            return res.status(400).json({ error: 'Клиент с таким ИД существует' });
        }
        await prisma.$transaction(async (prisma) => {
            const client = await prisma.client.create({
                data: {
                    name, phone
                },
                include: {
                    locations: { include: { location: true } },
                },
            });
            let newLocation = await prisma.location.create({ data: location });
            let clientlocation = await prisma.clientLocation.create({
                data: {
                    clientId: client.id,
                    locationId: newLocation.id
                }
            });
            const stocks = await prisma.stock.create({
                data: {
                    clientId: client.id,
                    locationId: newLocation.id,
                    quantity: 0,
                    productId: 1
                }
            });
            res.status(201).json(client);
        })
    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({ error });
    }
});

router.post("/updateclient", async (req, res) => {
    const { name, phone, location } = req.body;
    if (!name || !location || !location.latitude || !location.longitude) {
        return res.status(400).json({ message: "id, name and phone required" });
    }
    try {
        const client = await prisma.client.findFirst({
            where: { name }
        });
        if (!client) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }
        await prisma.$transaction(async (prisma) => {
            const updatedClient = await prisma.client.update({
                where: { id: client.id },
                data: {
                    phone
                },
                include: {
                    locations: { include: { location: true } },
                },
            });
            let updatedLocation = await prisma.location.update({
                where: { id: updatedClient.locations[0].location.id },
                data: location
            });
        });
        res.json(client);
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ error });
    }
});

export default router;