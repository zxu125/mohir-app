import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { UserController } from '../controllers/User.js';

const router = Router();

router.get('/', UserController.getAll);

router.post('/', UserController.create);

export default router;
