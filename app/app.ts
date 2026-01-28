import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import userRouter from './routes/user.js';
import authRouter from './routes/auth.js';
import authRefreshRouter from './routes/auth-refresh.js';
import clientRouter from './routes/client.js';
import orderRouter from './routes/order.js';
import mapRouter from './routes/map.js';
import regionRouter from './routes/region.js'
import { authMiddleware } from './middleware/authMiddleware.js';
import { auth as authRefreshMV } from './middleware/authRefreshMW.js';
import { InitWebSocket } from './ws/index.js';
// import { errorHandler } from './middleware/error/index.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(morgan('dev'));
// app.use(errorHandler)

// app.use('/users', userRouter);
app.use('/auth', authRefreshRouter);
app.use('/auth-refresh', authRefreshRouter);
app.use('/clients', authRefreshMV, clientRouter);
app.use('/user', authRefreshMV, userRouter);
app.use('/orders', authRefreshMV, orderRouter);
app.use('/map', authRefreshMV, mapRouter);
app.use('/region', authRefreshMV, regionRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

InitWebSocket(process.env.WS_PORT || 8080);

export default app;
