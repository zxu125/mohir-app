
import prisma from "../prismacl.js";

import { Router } from "express";

const router = Router();

router.get('/all', async (req: any, res) => {
    const params = req.query;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    try {
        let allStocks = await prisma.stock.findMany({
            include: {
                client: {
                    include: {
                        orders: {
                            where: {
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
                            include: { location: true, status: true }
                        },
                    }

                }, product: true,
                location: true,
            },
            where: {
                client: {
                    orders: {
                        some: params.has_orders == 'true' ? {
                            OR: [{
                                statusId: { notIn: [1, 2] }
                            },
                            {
                                completedDate: {
                                    gte: startOfDay,
                                    lte: endOfDay,
                                }
                            }]
                        } : undefined,
                    },
                    region: req.user.role.id == 1 ? {} : { id: { in: req.user.regions.map(e => e.id) } }
                },
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