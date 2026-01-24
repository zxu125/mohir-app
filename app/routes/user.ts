import { Router } from 'express';
import prisma from '../prismacl.js';
import bcrypt from 'bcryptjs'
import { PrismaClientValidationError } from '@prisma/client/runtime/library.js';

const router = Router();

router.get('/list', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                username: true, name: true, id: true, phone: true,
                regions: true,
                createdAt: true, updatedAt: true
            },
        });
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/add', async (req, res) => {
    try {
        const { username, password, name, phone, regionIds } = req.body;
        console.log(regionIds)
        // return res.status(500).json({ error: 'Регистрация отключена' });
        if (!username || !password || !name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: 'Пользователь с таким логином существует' });
        }
        let pass = bcrypt.hashSync(password)
        const user = await prisma.user.create({
            data: {
                username, password: pass, name, phone, roleId: 2,
                regions: { connect: req.body.regionIds?.map(r => ({ id: r })) || [] }
            },
            include: { regions: true }
        });
        res.json(user);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

router.get('/view', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: Number(req.query.id) },
            select: {
                username: true, name: true, id: true, phone: true,
                regions: true,
                createdAt: true, updatedAt: true
            },
        })
        res.json(user);
    }
    catch (err) {
        res.status(500).json(err);
    }
})

router.post('/edit', async (req, res) => {
    console.log('Edit user request body:', req.body);
    try {
        const { name, password, username, id, phone } = req.body;
        const existingUser = username ? await prisma.user.findUnique({
            where: { username }
        }) : null;
        if (existingUser && existingUser.id !== Number(id)) {
            return res.status(400).json({ error: 'Пользователь с таким логином существует' });
        }
        const user = await prisma.user.update({
            where: { id: Number(req.body.id) },
            data: {
                name,
                username,
                phone,
                password: password ? bcrypt.hashSync(password) : undefined,
                regions: req.body.regionIds ? { set: req.body.regionIds.map(r => ({ id: r })) } : undefined
            },
            select: {
                id: true,
                name: true,
                phone: true,
                username: true,
                regions: true
            }
        });
        res.json(user);
    } catch (err: PrismaClientValidationError | any) {
        res.status(500).json(err.message || err);
    }
})

export default router;
