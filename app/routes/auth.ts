import express from "express";
import prisma from "../prismacl.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import UserRoles from "../core/UserRoles.js";

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "super_secret";

// ✅ Логин
router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    console.log(user)
    if (!user || !user.isActive)
        return res.status(401).json({ message: "User not found or inactive" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, username: user.username, name: user.name } });
});

// ✅ Смена пароля
router.post("/change-password", async (req, res) => {
    const { username, oldPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid old password" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    res.json({ message: "Password changed" });
});

// ✅ Проверка токена (авто-логин)
router.get("/me", async (req, res) => { 
    const header = req.headers.authorization;
    console.log(header)
    if (!header) return res.status(401).json({ message: "Missing token" });
    const token = header.split(" ")[1];
    try {
        const { userId } = jwt.verify(token, SECRET) as any;
        const user:any = await prisma.user.findUnique({ where: { id: userId } });
        user.role = UserRoles.find(e => e.id == user.roleId)
        res.json({ user });
    } catch {
        res.status(401).json({ message: "Invalid token" });
    }
});

export default router;
