import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export function errorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) {
    console.error('💥 Error:', err);

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // Например, уникальное поле
        if (err.code === 'P2002') {
            return res.status(409).json({
                error: 'Conflict: Duplicate field value',
                meta: err.meta,
            });
        }
    }

    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
    });
}
