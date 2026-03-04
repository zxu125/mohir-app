import prisma from "../prismacl.js";

import { Router } from "express";
import OrderController from "../controllers/Order.js";
import UserRoles from "../core/UserRoles.js";
import { OrderStatus } from "../core/orderStatus.js";
import { count } from "console";
import { tr } from "zod/v4/locales";

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
    const search = String(params.search)
    try {
        const orders: any = await prisma.order.findMany({
            where: {
                clientId: params.clientId ? Number(params.clientId) : undefined,
                statusId: { equals: params.statusId ? Number(params.statusId) : undefined, notIn: [1, 2] },
                orderDate: params.orderDate ? new Date(String(params.orderDate)) : undefined,
                client: params.search ? {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search, mode: 'insensitive' } },
                        { phone2: { contains: search, mode: 'insensitive' } },
                        { deliveryNote: { contains: search, mode: 'insensitive' } },
                    ]
                } : undefined
            },
            include: {
                client: { select: { id: true, name: true, email: true, phone: true, phone2: true } },
                location: true,
                status: true,
            },
            orderBy: { orderDate: "asc" }
        });
        orders.forEach(order => {
            order.status = OrderStatus.find(s => s.id === order.statusId);
        });
        res.json(orders);
    } catch (error) {
        console.log(error)
        res.status(500).json({ error });
    }
});

router.post('/history', async (req, res) => {
    const { startDate, endDate, clientId, searchText, userId, statusId } = req.body;
    console.log(req.body);
    try {
        const orders = await prisma.order.findMany({
            where: {
                clientId: clientId ? Number(clientId) : undefined,
                userId: userId ? Number(userId) : undefined,
                orderDate: {
                    gte: startDate ? new Date(startDate) : undefined,
                    lte: endDate ? new Date(endDate) : undefined,
                },
                statusId: { in: [1, 2], equals: statusId ? Number(statusId) : undefined },
                OR: searchText ? [
                    { note: { contains: searchText, mode: 'insensitive' } },
                    { client: { name: { contains: searchText, mode: 'insensitive' } } },
                ] : undefined,
            },
            include: {
                client: { select: { id: true, name: true, email: true } },
                location: true,
                status: true,
                user: true,
            },
            orderBy: { completedDate: "desc" }
        });
        orders.forEach((order: any) => {
            order.status = OrderStatus.find(s => s.id === order.statusId);
        });
        console.log(orders);
        res.json(orders);
    } catch (error) {
        console.log(error)
        res.status(500).json({ error });
    }
});

// Create a new order
router.post('/add', async (req, res) => {
    console.log('add: ', req.body);
    const { clientId, totalAmount, orderDate, note, deliveryDate } = req.body;
    try {
        const client = await prisma.client.findUnique({
            where: { id: Number(clientId) },
            include: { locations: { include: { location: true } } },
        })
        const location = client!.locations[0]?.location
        console.log(1);
        const price = await prisma.product.findUnique({ where: { id: 1 } }).then(p => p?.price || 0)
        const order = await prisma.order.create({
            data: {
                clientId: Number(clientId),
                totalAmount: Number(totalAmount),
                locationId: location.id,
                orderDate,
                deliveryDate,
                statusId: 5,
                note,
                price: Number(totalAmount) * price,
            },
        });
        console.log(1);
        res.status(201).json(order);
    } catch (error) {
        res.status(500).json({ error });
    }
});

// Get an order by ID
router.get('/view/:id', async (req, res) => {
    try {
        console.log(req.body)
        const price = await prisma.product.findUnique({ where: { id: 1 } }).then(p => p?.price || 0)
        const order: any = await prisma.order.findUnique({
            where: { id: Number(req.params.id) },
            include: { user: true, client: { include: { region: true, stocks: true } }, location: true },
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found', id: req.params.id });
        }
        order.status = OrderStatus.find(s => s.id === order.statusId);
        order.delivery = { countGiven: order.countGivenn, countGotten: order.countGotten, note: order.note, completedDate: order.completedDate }
        order.Delivery = undefined
        order.productPrice = price
        order.currentStock = order.client?.stocks?.[0]?.quantity || 0
        res.json(order);
    } catch (error) {
        console.log(error)
        res.status(500).json({ error });
    }
});

// Update an order by ID
router.post('/edit', async (req, res) => {
    const { id, totalAmount, orderDate, note, priority, deliveryDate } = req.body;
    console.log('edit ', req.body);
    try {
        const price = await prisma.product.findUnique({ where: { id: 1 } }).then(p => p?.price || 0)
        const order = await prisma.order.update({
            where: { id: Number(id) },
            data: {
                totalAmount: Number(totalAmount),
                orderDate,
                deliveryDate,
                note,
                locationId: req.body.location?.id,
                // priority: priority.id,
                price: Number(totalAmount) * price,
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
    console.log(req.body)
    const { id, statusId } = req.body;
    try {
        const order = await prisma.order.update({
            where: { id: Number(id) },
            data: { statusId: Number(statusId) },
        });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error });
    }
})

router.post('/complete-order', async (req, res) => {
    const { id, countGotten, countGiven, note } = req.body;
    console.log(req.body)
    const order: any = await prisma.order.findUnique({ where: { id: Number(id) } })
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
                    userId: (req as any).user?.id,
                    countGivenn: Number(countGiven),
                    countGotten: Number(countGotten),
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
    let order: any = await prisma.order.findUnique({ where: { id: Number(id) } })
    if ([1, 2].includes(order.statusId)) {
        res.status(500).json({ message: 'Нельзя подтвердить' });
    }
    try {
        order = await prisma.order.update({
            where: { id: Number(id) },
            data: { statusId: 1, note, completedDate: new Date(), userId: (req as any).user?.id },
        })
        res.json(order)
    } catch (err) {
        res.status(500).json({ err })
    }
})

export default router;
