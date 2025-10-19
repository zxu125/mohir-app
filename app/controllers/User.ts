import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs'

import prisma from '../prismacl.js';

export class UserController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await prisma.user.findMany({ include: { regions: true } });
      res.json(users);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password, name } = req.body;
      let pass = bcrypt.hashSync(password)
      const user = await prisma.user.create({
        data: {
          username, password: pass, name,
          regions: { connect: [] }
        },
        select: { regions: true }
      });
      res.json(user);
    } catch (err) {
      res.status(500).json(err);
    }
  }
}
