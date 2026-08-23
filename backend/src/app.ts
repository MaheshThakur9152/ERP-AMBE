import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { env } from './config/env';
import { apiLimiter, authLimiter } from './middlewares/rateLimiter';

const app = express();

// 1. Reverse Proxy Trust (Express behind Heroku, Cloudflare, AWS load balancers)
app.set('trust proxy', 1);

// 2. HTTP Security Headers (Helmet)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
  })
);

// 3. Strict Environment-Driven CORS
const DEFAULT_ALLOWED_ORIGINS = [
  'https://admin.ambeservice.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
];
const envOrigins = `${env.FRONTEND_URL || ''},${env.CLIENT_URL || ''}`
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins]));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., server-to-server, mobile apps, curl), matching allowed list, or *.vercel.app subdomains
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes(origin.replace(/\/+$/, '')) || /\.vercel\.app$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS request rejected: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

// 4. Request Body Size Limits & Cookie Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// 5. Rate Limiting
app.use('/api', apiLimiter);

// API Root Route
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

export default app;
