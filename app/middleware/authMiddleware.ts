// middleware/auth.ts
import jwt from "jsonwebtoken";
const SECRET = process.env.JWT_SECRET || "super_secret";
import prisma from "../prismacl.js";
import UserRoles from "../core/UserRoles.js";
import { Request } from "express";

export async function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    try {
        const decoded = jwt.verify(token, SECRET);
        const user: any = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                regions: true, id: true, name: true, username: true, isActive: true, roleId: true
            }
        });
        // return res.json(user)
        if (!user || !user.isActive)
            return res.status(401).json({ message: "User not found or inactive" }); 
        let { path, url, baseUrl, originalUrl } = req
        user.role = UserRoles.find((role) => role.id === user.roleId);
        if (user.role.id != 1) {
            let routes = Object.keys(user.role.routes).map(r => {
                return Object.keys(user.role.routes[r]).map(r2 => '/' + r + '/' + user.role.routes[r][r2])
            }).reduce((p, c) => { return p.concat(c) }, [])
            if (!routes.includes(originalUrl.split('?')[0])) return res.status(401).json({ message: "Permission denied" });
        }
        if (user.role)
            req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ err });
    }
}
