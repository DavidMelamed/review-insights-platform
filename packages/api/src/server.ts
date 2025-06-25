import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/express';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { Queue } from 'bull';
import { router as reviewsRouter } from './routes/reviews';
import { router as reportsRouter } from './routes/reports';
import { router as authRouter } from './routes/auth';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { logger } from './utils/logger';
import { connectDatabase } from './database';
import { redis } from './redis';

const app = express();
const PORT = process.env.PORT || 3000;

// Job Queues
export const reviewCollectionQueue = new Queue('review-collection', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export const reportGenerationQueue = new Queue('report-generation', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

// Bull Board for Queue Monitoring
const { adapter, router: bullBoardRouter } = createBullBoard({
  queues: [
    new BullAdapter(reviewCollectionQueue),
    new BullAdapter(reportGenerationQueue),
  ],
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      redis: redis.status === 'ready' ? 'connected' : 'disconnected',
      queues: 'active',
    },
  });
});

// Public routes
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/reviews', authMiddleware, reviewsRouter);
app.use('/api/reports', authMiddleware, reportsRouter);

// Admin routes
app.use('/admin/queues', authMiddleware, bullBoardRouter);

// Error handling
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected');

    // Start job processors
    await import('./jobs/review-collector');
    await import('./jobs/report-generator');
    logger.info('Job processors started');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Bull Board available at http://localhost:${PORT}/admin/queues`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close job queues
  await reviewCollectionQueue.close();
  await reportGenerationQueue.close();
  
  // Close database connections
  await redis.quit();
  
  process.exit(0);
});