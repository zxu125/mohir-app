
import prisma from "../prismacl.js";

import { Router } from "express";

const router = Router();

router.get('/all', async (req, res) => {
    const params = req.query;
    try {
        let allStocks = await prisma.stock.findMany({
            include: {
                client: {
                    include: {
                        orders: { include: { location: true, status: true } },
                    }

                }, product: true,
                location: true,

            },
            where: {
                client: {
                    orders: params.has_orders == 'true' ? {
                        some: {}
                    } : undefined
                }
            }
        });
        allStocks = allStocks.map(stock => ({
            ...stock,
            order: stock.client.orders.length > 0 ?
                ((o) => {
                    return {
                        ...o,
                        status: o.status.status,
                    }
                })(stock.client.orders[0]) : null
        }));
        res.json(allStocks);
    } catch (error) {
        res.status(500).json({ error });
    }
});

export default router;