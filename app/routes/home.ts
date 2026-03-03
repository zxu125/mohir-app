import prisma from "../prismacl.js";

import { Router } from "express";

const router = Router();

router.get('/', async (req, res) => {
    try {
        const orderCount = await prisma.order.count({
            where: { statusId: { notIn: [1, 2] } }
        })
        const totalStock = await prisma.stock.aggregate({
            _sum: { quantity: true }
        })
        res.json({ orderCount, totalStock: totalStock._sum.quantity || 0 });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error });
    }
});

export default router;