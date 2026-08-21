import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { env } from './config/env';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL || true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Root Route
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

export default app;
