import prisma from "../prismacl.js";

import { Router } from "express";
import OrderController from "../controllers/Order.js";
import UserRoles from "../core/UserRoles.js";

const router = Router();

type Order = {
    id: number;
    clientId: number;
    statusId: number;
    totalAmount: number;
    orderDate: Date;
    note,
};

//Query orders with client and location info
router.get('/list', async (req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const params = req.query;
    try {
        const orders = await prisma.order.findMany({
            where: {
                clientId: params.clientId ? Number(params.clientId) : undefined,
                statusId: params.statusId ? Number(params.statusId) : undefined,
                orderDate: params.orderDate ? new Date(String(params.orderDate)) : undefined,
                OR: [{
                    statusId: { notIn: [1, 2] }
                },
                {
                    completedDate: {
                        gte: startOfDay,
                        lte: endOfDay,
                    }
                }]
            },
            include: {
                client: { select: { id: true, name: true, email: true } },
                location: true,
                status: true,
            },
            orderBy: { orderDate: "asc" }
        });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error });
    }
});

// Create a new order
router.post('/add', async (req, res) => {
    const { clientId, totalAmount, orderDate, note }: Order = req.body;
    try {
        const client = await prisma.client.findUnique({
            where: { id: Number(clientId) },
            include: { locations: { include: { location: true } } },
        })
        const location = client!.locations[0]?.location
        console.log(location);
        const order = await prisma.order.create({
            data: {
                clientId: Number(clientId),
                totalAmount: Number(totalAmount),
                locationId: location.id,
                orderDate,
                statusId: 5,
                note,
            },
        });
        res.status(201).json(order);
    } catch (error) {
        res.status(500).json({ error });
    }
});

// Get an order by ID
router.get('/view/:id', async (req, res) => {
    try {
        const order = await prisma.order.findUnique({
            where: { id: Number(req.params.id) },
            include: { client: true, location: true, status: true, Delivery: true },
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found', id: req.params.id });
        }
        res.json(order);
    } catch (error) {
        res.status(500).json({ error });
    }
});

// Update an order by ID
router.post('/edit', async (req, res) => {
    const { id, totalAmount, orderDate, note } = req.body;
    try {
        const order = await prisma.order.update({
            where: { id: Number(id) },
            data: {
                totalAmount: Number(totalAmount),
                orderDate,
                note,
                locationId: req.body.location?.id
            },
        });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error });
    }
});

// Delete an order by ID
router.post('/delete/:id', async (req, res) => {
    try {
        const order = await prisma.order.delete({
            where: { id: Number(req.params.id) },
        });
        if ([1, 2].includes(order.statusId)) return res.status(401).json({ message: "Couldn't delete order" })
        res.json({ message: 'Order deleted successfully', order });
    } catch (error) {
        res.status(500).json({ error });
    }
});

router.post('/change-status', async (req, res) => {
    const { id, statusId } = req.body;
    try {
        const order = await OrderController.changeStatus({ id, statusId });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error });
    }
})

router.post('/complete-order', async (req, res) => {
    const { id, countGotten, countGiven, note } = req.body;
    const order: any = await prisma.order.findUnique({ where: { id } })
    if ([1, 2].includes(order.statusId)) {
        res.status(500).json({ message: 'Нельзя подтвердить' });
    }
    try {
        const order = await prisma.$transaction(async (tr) => {
            const updatedOrder = await tr.order.update({
                where: { id: Number(id) },
                data: {
                    statusId: 2,
                    completedDate: new Date(),
                    Delivery: {
                        create: {
                            countGotten: Number(countGotten),
                            countGiven: Number(countGiven),
                            note,
                        },
                    },
                },
                include: {
                    client: {
                        include: { stocks: true },
                    },
                },
            });

            if (updatedOrder.client?.stocks?.length) {
                await tr.stock.update({
                    where: { id: updatedOrder.client.stocks[0].id },
                    data: {
                        quantity: { increment: Number(countGiven) - Number(countGotten) },
                    },
                });
            }

            return updatedOrder.id;
        });

        const fullOrder = await prisma.order.findUnique({
            where: { id: order },
            include: {
                Delivery: true,
                client: { include: { stocks: true } },
            },
        });

        res.json(fullOrder);
    } catch (error) {
        res.status(500).json({ error });
    }
});

router.post('/cancel-order', async (req, res) => {
    const { id, note } = req.body;
    let order: any = await prisma.order.findUnique({ where: { id } })
    if ([1, 2].includes(order.statusId)) {
        res.status(500).json({ message: 'Нельзя подтвердить' });
    }
    try {
        order = await prisma.order.update({
            where: { id },
            data: { statusId: 1, note, completedDate: new Date() }
        })
        res.json(order)
    } catch (err) {
        res.status(500).json({ err })
    }
})

export default router;