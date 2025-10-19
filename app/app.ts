import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import userRouter from './routes/user.js';
import authRouter from './routes/auth.js';
import clientRouter from './routes/client.js';
import orderRouter from './routes/order.js';
import mapRouter from './routes/map.js';
import regionRouter from './routes/region.js'
import { authMiddleware } from './middleware/authMiddleware.js';
// import { errorHandler } from './middleware/error/index.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(morgan('dev'));
// app.use(errorHandler)

// app.use('/users', userRouter);
app.use('/auth', authRouter);
app.use('/clients', authMiddleware, clientRouter);
app.use('/user', authMiddleware, userRouter);
app.use('/orders', authMiddleware, orderRouter);
app.use('/map', authMiddleware, mapRouter);
app.use('/region', authMiddleware, regionRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

export default app;
