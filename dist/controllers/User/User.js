import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export class UserController {
    static async getAll(req, res, next) {
        try {
            const users = await prisma.user.findMany();
            res.json(users);
        }
        catch (err) {
            next(err);
        }
    }
    static async create(req, res, next) {
        try {
            const { name, email } = req.body;
            const user = await prisma.user.create({ data: { name, email } });
            res.json(user);
        }
        catch (err) {
            next(err);
        }
    }
}
