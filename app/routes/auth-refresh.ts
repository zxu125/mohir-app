
import prisma from "../prismacl.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import UserRoles from "../core/UserRoles.js";
import express from "express";
import crypto from "crypto";
import { signAccessToken, signRefreshToken, verifyRefresh } from "../helpers/tokens.js";

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "super_secret";

// LOGIN: выдаём access + refresh 
router.post("/login", async (req, res) => {
    const { username, password } = req.body || {};
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ message: "Bad credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Bad credentials" });

    const accessToken = signAccessToken(user);

    const tokenId = crypto.randomUUID();
    const refreshToken = signRefreshToken(user, tokenId);

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30d (синхронизируй с REFRESH_TOKEN_TTL)

    await prisma.refreshTokens.create({
        data: {
            id: tokenId.toString(),
            userId: user.id,
            tokenHash,
            revoked: false,
            expiresAt
        }
    });

    return res.json({ accessToken, refreshToken, user: { id: user.id, username: user.username, name: user.name } });
});

// REFRESH: проверяем refresh, сверяем с БД, делаем ротацию
router.post("/refresh", async (req, res) => {
    const { refreshToken } = req.body || {};
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

    // await prisma.refreshTokens.update({
    //     where: { id: stored.id },
    //     data: { revoked: true }
    // });
    await prisma.refreshTokens.delete({
        where: { id: stored.id }
    });

    const newTid = crypto.randomUUID();
    const user = { id: userId };

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user, newTid);

    const newHash = await bcrypt.hash(newRefreshToken, 10);
    const newExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    await prisma.refreshTokens.create({
        data: {
            id: newTid,
            userId,
            tokenHash: newHash,
            revoked: false,
            expiresAt: newExpiresAt,
        }
    });

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
});

// LOGOUT: отзываем refresh токен
router.post("/logout", async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ message: "refreshToken required" });

    try {
        const payload = verifyRefresh(refreshToken);
        const stored = await prisma.refreshTokens.findUnique({ where: { id: payload.tid } });
        if (stored) stored.revoked = true;
    } catch {
        return res.json({ ok: true });
    }

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
});

export default router;