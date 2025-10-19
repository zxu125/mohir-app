import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { UserController } from '../controllers/User.js';
import prisma from '../prismacl.js';

const router = Router();

router.get('/list', UserController.getAll);

router.post('/add', UserController.create);

router.get('/view/:id', async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: Number(req.params.id) },
        include: { regions: true }
    })
})

router.post('/edit', async (req, res) => {
    try {
        const { name } = req.body;
        const user = await prisma.user.update({
            where: { id: Number(req.body.id) },
            data: {
                name,
                regions: { set: req.body.regions?.map(e => ({ id: e.id })) }
            },
            select: {
                id: true,
                name: true,
                username: true,
                regions: true
            }
        });
        res.json(user);
    } catch (err) {
        res.status(500).json(err);
    }
})

export default router;
