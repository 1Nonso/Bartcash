import express from 'express';
import cors from 'cors';
import cookieparser from 'cookie-parser';
import morgan from 'morgan';
import authRoutes from '../src/routes/auth.routes';
import userRoutes from '../src/routes/user.routes';
import categoryRoutes from '../src/routes/categories.routes';
import itemRoutes from '../src/routes/item.routes';
import tradeRoutes from '../src/routes/trade.routes';
import ratingRoutes from '../src/routes/rating.routes';
import transactionRoutes from '../src/routes/transaction.routes';
import disputeRoutes from '../src/routes/dispute.routes';
import commentRoutes from '../src/routes/comment.routes';
import notificationRoutes from '../src/routes/notification.routes';
import messageRoutes from '../src/routes/message.routes';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { resetPasswordRedirect } from './controllers/auth.controllers';

const app = express();

app.use(morgan('combined'));
app.use(express.json());
app.use(
   cors({
      origin: process.env.CLIENT_URL,
      credentials: true,
   }),
);
app.use(cookieparser());
app.set('trust proxy', 1);
app.get('/health', (_req, res) =>
   res.json({ ok: true }),
);
app.get(
   '/reset-password-redirect',
   resetPasswordRedirect,
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api', commentRoutes); // /items/:id/comments, /comments/:id (before items)
app.use('/api', ratingRoutes); // /ratings, /users/:id/ratings
app.use('/api/items', itemRoutes);
app.use(
   '/api/categories',
   categoryRoutes,
);
app.use('/api/trades', tradeRoutes);
app.use('/api/trades', messageRoutes); // /:id/messages...
app.use('/api/disputes', disputeRoutes);
app.use(
   '/api/notifications',
   notificationRoutes,
);
app.use(
   '/api/transactions',
   transactionRoutes,
);

// Global error handler (should be after routes)
app.use(errorHandler);

export default app;
