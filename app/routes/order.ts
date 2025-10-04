import prisma from "../prismacl.js";

import { Router } from "express";
import OrderController from "../controllers/Order.js";

const router = Router();

type Order = {
    id: number;
    clientId: number;
    statusId: number;
    totalAmount: number;
    orderDate: Date;
};

//Query orders with client and location info
router.get('/list', async (req, res) => {
    const params = req.query;
    try {
        const orders = await prisma.order.findMany({
            where: {
                clientId: params.clientId ? Number(params.clientId) : undefined,
                statusId: params.statusId ? Number(params.statusId) : undefined,
                orderDate: params.orderDate ? new Date(String(params.orderDate)) : undefined,
            },
            include: {
                client: { select: { id: true, name: true, email: true } },
                location: true,
                status: true,
            },
        });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error });
    }
});

// Create a new order
router.post('/add', async (req, res) => {
    const { clientId, totalAmount, orderDate, statusId }: Order = req.body;
    try {
        const client = await prisma.client.findUnique({
            where: { id: Number(clientId) },
            include: { locations: { include: { location: true } } },
        })
        const location = req.body.location || client?.locations[0]?.location
        console.log(location);
        const order = await prisma.order.create({
            data: {
                clientId: Number(clientId), totalAmount: Number(totalAmount), locationId: location.id, orderDate, statusId: statusId || 1
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
    const { id, statusId, totalAmount, orderDate } = req.body;
    try {
        const order = await prisma.order.update({
            where: { id: Number(id) },
            data: { statusId, totalAmount: Number(totalAmount), orderDate, locationId: req.body.location?.id },
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
    const { id, statusId, deliveryDate } = req.body;
    try {
        const order = await OrderController.completeOrder({ id, statusId, deliveryDate });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error });
    }
});

export default router;