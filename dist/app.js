import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRouter from './routes/user';
import { errorHandler } from './middleware/error';
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//app.use(morgan('dev'));
app.use(errorHandler);
app.use('/users', userRouter);
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});
export default app;
