import { Request, Response, NextFunction } from 'express';

import prisma from '../prismacl.js';

export class UserController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await prisma.user.findMany();
      res.json(users);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email } = req.body;
      const user = await prisma.user.create({ data: { name, email } });
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
}
