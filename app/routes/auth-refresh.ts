
import prisma from "../prismacl.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import UserRoles from "../core/UserRoles.js";
import express from "express";
import crypto from "crypto";
import { signAccessToken, signRefreshToken, verifyRefresh, verifyTelegramInitData, parseInitData } from "../helpers/tokens.js";

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "super_secret";

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d bigint (ms)

const BOT_TOKEN = process.env.BOT_TOKEN; // токен бота BotFather

router.post("/tg/handshake", async (req, res) => {
    const { initData } = req.body || {};
    if (!initData) return res.status(400).json({ message: "initData required" });
    if (!BOT_TOKEN) return res.status(500).json({ message: "BOT_TOKEN missing" });
    const ok = verifyTelegramInitData(initData, BOT_TOKEN);
    if (!ok) return res.status(401).json({ message: "Bad initData signature" });

    const { user, authDate } = parseInitData(initData);
    if (!user?.id) return res.status(400).json({ message: "No user in initData" });

    // auth_date в секундах
    const nowSec = Math.floor(Date.now() / 1000);
    if (!authDate || nowSec - authDate > 24 * 60 * 60) {
        return res.status(401).json({ message: "initData too old" });
    }

    // Сделаем короткий "tgSession" JWT на 3-5 минут (отдельный секрет можно)
    const tgSession = jwt.sign(
        { tg: String(user.id) },
        SECRET,
        { expiresIn: "5m" }
    );

    return res.json({ tgSession, tgUser: { id: user.id, first_name: user.first_name } });
});

router.post("/login", async (req, res) => {
    const parsed = req.body;

    const { username, password, installId, device, clientType = "mobile", tgSession } = parsed;

    // 0) если telegram webapp — проверяем tgSession
    let tgUserId = null;

    if (clientType === "webapp_tg") {
        if (!tgSession) return res.status(400).json({ message: "tgSession required" });

        try {
            const p = jwt.verify(tgSession, SECRET);
            tgUserId = p.tg; // строка id
        } catch {
            return res.status(401).json({ message: "Bad tgSession" });
        }
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ message: "Bad credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Bad credentials" });

    // 1) upsert device
    const finalInstallId =
        clientType === "webapp_tg"
            ? `tg:${tgUserId}`         // или `tg:${tgUserId}:${someBrowserId}`
            : installId;

    if (!finalInstallId) return res.status(400).json({ message: "installId required" });

    const now = new Date();
    const dbDevice = await prisma.device.upsert({
        where: { installId: finalInstallId },
        create: {
            installId: finalInstallId,
            platform: clientType === "webapp_tg" ? "tg_web" : (device?.platform ?? "android"),
            deviceName: device?.deviceName ?? null,
            osVersion: device?.osVersion ?? null,
            appVersion: device?.appVersion ?? null,
            lastSeenAt: now,
        },
        update: {
            platform: device?.platform ?? undefined,
            deviceName: device?.deviceName ?? undefined,
            osVersion: device?.osVersion ?? undefined,
            appVersion: device?.appVersion ?? undefined,
            lastSeenAt: now,
        },
        select: { id: true, installId: true, platform: true },
    });

    // 2) (опционально) если хочешь: "1 активная сессия на девайс"
    // тогда перед созданием новой — ревокнем старые активные:
    await prisma.refreshTokens.updateMany({
        where: {
            userId: user.id,
            deviceId: dbDevice.id,
            revoked: false,
            expiresAt: { gt: BigInt(Date.now()) },
        },
        data: {
            revoked: true,
            revokedAt: now,
        },
    });

    // 3) токены
    const accessToken = signAccessToken(user);

    const tokenId = crypto.randomUUID();
    const refreshToken = signRefreshToken(user, tokenId);

    // важный момент:
    // bcrypt(refreshToken) ок, но можно быстрее: hash(refreshToken) sha256
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    const expiresAt = Date.now() + REFRESH_TTL_MS;

    // 4) сессия (refresh_tokens)
    await prisma.refreshTokens.create({
        data: {
            id: tokenId,
            userId: user.id,
            deviceId: dbDevice.id,
            tokenHash,
            revoked: false,
            revokedAt: null,
            expiresAt,

            clientType,
            tgUserId: tgUserId ? BigInt(tgUserId) : null,

            issuedAt: now,
            lastUsedAt: now,
        },
    });

    if (clientType === "webapp_tg") {
        res.cookie("rt", refreshToken, {
            httpOnly: true,
            secure: true,    // на https
            sameSite: "none", // раз у тебя тот же домен
            path: "/auth",
            maxAge: REFRESH_TTL_MS,
        });

        return res.json({
            accessToken,
            user: { id: user.id, username: user.username, name: user.name },
            device: { id: dbDevice.id, installId: dbDevice.installId, platform: dbDevice.platform },
        });
    }

    // mobile as is:
    return res.json({ accessToken, refreshToken, user: { id: user.id, username: user.username, name: user.name }, device: { id: dbDevice.id, installId: dbDevice.installId, platform: dbDevice.platform } });
});


router.post("/refresh", async (req, res) => {
    console.log('refresh', req.body, req.cookies);
    const bodyToken = req.body?.refreshToken;
    const cookieToken = req.cookies?.rt;
    const refreshToken = bodyToken || cookieToken;

    if (!refreshToken) return res.status(400).json({ message: "refreshToken required" });

    let payload;
    try {
        payload = verifyRefresh(refreshToken);
    } catch {
        return res.status(401).json({ message: "Invalid refresh token" });
    }

    const tokenId = payload.tid;
    const userId = payload.sub;

    const stored = await prisma.refreshTokens.findUnique({ where: { id: tokenId } });
    if (!stored) return res.status(401).json({ message: "Refresh not found" });
    if (stored.revoked) return res.status(401).json({ message: "Refresh revoked" });
    if (stored.expiresAt < Date.now()) return res.status(401).json({ message: "Refresh expired" });
    if (stored.userId !== userId) return res.status(401).json({ message: "Token/user mismatch" });

    const match = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!match) return res.status(401).json({ message: "Refresh token mismatch" });

    // Ротация: старый refresh помечаем revoked, выдаём новый
    stored.revoked = true;

    const newTid = crypto.randomUUID();
    const user = { id: userId };

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user, newTid);

    const newHash = await bcrypt.hash(newRefreshToken, 10);
    const newExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    const now = new Date();

    await prisma.refreshTokens.update({
        where: { id: stored.id },
        data: { revoked: true, revokedAt: now, replacedById: newTid, lastUsedAt: now },
    });

    await prisma.refreshTokens.create({
        data: {
            id: newTid,
            userId,
            tokenHash: newHash,
            deviceId: stored.deviceId,
            revoked: false,
            expiresAt: BigInt(newExpiresAt),
            clientType: stored.clientType,
            tgUserId: stored.tgUserId,
            issuedAt: now,
            lastUsedAt: now,
        }
    });

    await prisma.refreshTokens.create({
        data: {
            id: newTid,
            userId,
            tokenHash: newHash,
            deviceId: stored.deviceId,
            revoked: false,
            expiresAt: newExpiresAt,
        }
    });

    if (!bodyToken) {
        res.cookie("rt", newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/auth",
            maxAge: REFRESH_TTL_MS,
        });
        return res.json({ accessToken: newAccessToken });
    }

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
});

router.post("/logout", async (req, res) => {
    const token = req.body?.refreshToken || req.cookies?.rt;
    if (!token) return res.json({ ok: true });

    try {
        const payload = verifyRefresh(token);
        await prisma.refreshTokens.update({
            where: { id: payload.tid },
            data: { revoked: true, revokedAt: new Date() },
        });
    } catch { }

    res.clearCookie("rt", { path: "/auth" });
    return res.json({ ok: true });
});


router.get("/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    let payload;
    try {
        payload = jwt.verify(token, SECRET);
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user });
})

export default router;