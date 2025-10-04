import prisma from '../prismacl.js';

import { Request, Response, NextFunction } from 'express';

class OrderController {
    async changeStatus(param: { id: string; statusId: string }) {
        return await prisma.order.update({
            where: { id: Number(param.id) },
            data: { statusId: Number(param.statusId) },
        });
    }
    async completeOrder(param: { id: string; statusId: string, deliveryDate: string }) {
        return await prisma.order.update({
            where: { id: Number(param.id) },
            data: {
                statusId: Number(param.statusId),
                Delivery: { create: { deliveryDate: param.deliveryDate } }
            },
            include: { Delivery: true }
        });
    }

}

export default new OrderController();