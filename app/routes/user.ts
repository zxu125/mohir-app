import { Router } from 'express';
import prisma from '../prismacl.js';
import bcrypt from 'bcryptjs'
import { PrismaClientValidationError } from '@prisma/client/runtime/library.js';
import { PushTokenStatus } from "@prisma/client";

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

router.post('/register-device', async (req, res) => {
    const userId = (req as any).user?.id as number | undefined;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const parsed = req.body;

    const { installId, expoPushToken, platform, deviceName, osVersion, appVersion } = parsed;

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
        // 1) upsert device по installId
        const device = await tx.device.upsert({
            where: { installId },
            create: {
                installId,
                platform,
                deviceName: deviceName ?? null,
                osVersion: osVersion ?? null,
                appVersion: appVersion ?? null,
                lastSeenAt: now,
            },
            update: {
                platform,
                deviceName: deviceName ?? undefined,
                osVersion: osVersion ?? undefined,
                appVersion: appVersion ?? undefined,
                lastSeenAt: now,
            },
        });

        // 2) если токен уже существует — просто "подтвердим" что он живой
        const existingToken = await tx.pushToken.findUnique({
            where: { expoToken: expoPushToken },
            select: { id: true, deviceId: true, status: true },
        });

        if (existingToken) {
            // важно: токен может "переехать" (редко, но пусть будет защита)
            // если вдруг token привязан к другому device — отключаем старый и создаём новый на текущий device
            if (existingToken.deviceId !== device.id) {
                await tx.pushToken.update({
                    where: { id: existingToken.id },
                    data: {
                        status: PushTokenStatus.disabled,
                        disabledAt: now,
                        disableReason: "token_moved_to_another_device",
                    },
                });

                await tx.pushToken.updateMany({
                    where: { deviceId: device.id, status: PushTokenStatus.active },
                    data: { status: PushTokenStatus.rotated },
                });

                const newToken = await tx.pushToken.create({
                    data: {
                        deviceId: device.id,
                        expoToken: expoPushToken,
                        status: PushTokenStatus.active,
                        lastSeenAt: now,
                    },
                    select: { id: true, expoToken: true, status: true },
                });

                return { device, pushToken: newToken, tokenAction: "moved_recreated" as const };
            }

            // тот же device — обновляем lastSeen/status
            const updated = await tx.pushToken.update({
                where: { id: existingToken.id },
                data: {
                    lastSeenAt: now,
                    status: existingToken.status === PushTokenStatus.disabled ? PushTokenStatus.active : existingToken.status,
                    disabledAt: existingToken.status === PushTokenStatus.disabled ? null : undefined,
                    disableReason: existingToken.status === PushTokenStatus.disabled ? null : undefined,
                },
                select: { id: true, expoToken: true, status: true },
            });

            // rotate остальных active токенов этого device (чтобы был один active)
            await tx.pushToken.updateMany({
                where: {
                    deviceId: device.id,
                    status: PushTokenStatus.active,
                    id: { not: updated.id },
                },
                data: { status: PushTokenStatus.rotated },
            });

            return { device, pushToken: updated, tokenAction: "reused" as const };
        }

        // 3) токен новый: rotate старые active токены этого device
        await tx.pushToken.updateMany({
            where: { deviceId: device.id, status: PushTokenStatus.active },
            data: { status: PushTokenStatus.rotated },
        });

        // 4) создаём новый active токен
        const created = await tx.pushToken.create({
            data: {
                deviceId: device.id,
                expoToken: expoPushToken,
                status: PushTokenStatus.active,
                lastSeenAt: now,
            },
            select: { id: true, expoToken: true, status: true },
        });

        return { device, pushToken: created, tokenAction: "created" as const };
    });

    // 5) (Опционально) привязка "user залогинен на device" через refresh_sessions:
    // это происходит на login/refresh, а не тут. Здесь достаточно userId из access.

    return res.json({
        ok: true,
        deviceId: result.device.id,
        pushTokenId: result.pushToken.id,
        tokenStatus: result.pushToken.status,
        tokenAction: result.tokenAction,
    });
});

export default router;
