import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { reviewCollectionQueue } from '../server';
import { prisma } from '../database';
import { logger } from '../utils/logger';

export const router = Router();

// Start review collection job
router.post(
  '/collect',
  [
    body('businessName').notEmpty().trim(),
    body('location').optional().trim(),
    body('sources').optional().isArray(),
    body('includeCompetitors').optional().isBoolean(),
    body('depth').optional().isInt({ min: 10, max: 1000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { businessName, location, sources, includeCompetitors, depth } = req.body;
      const userId = req.user.id;

      // Create review collection record
      const collection = await prisma.reviewCollection.create({
        data: {
          userId,
          businessName,
          location,
          sources: sources || ['google', 'yelp', 'trustpilot'],
          status: 'pending',
          includeCompetitors: includeCompetitors || false,
          requestedDepth: depth || 100,
        },
      });

      // Queue the job
      const job = await reviewCollectionQueue.add('collect-reviews', {
        collectionId: collection.id,
        businessName,
        location,
        sources: collection.sources,
        includeCompetitors: collection.includeCompetitors,
        depth: collection.requestedDepth,
      });

      res.json({
        message: 'Review collection started',
        collectionId: collection.id,
        jobId: job.id,
        estimatedTime: '5-10 minutes',
      });
    } catch (error) {
      logger.error('Failed to start review collection', error);
      res.status(500).json({ error: 'Failed to start review collection' });
    }
  }
);

// Get collection status
router.get('/collections/:id', async (req, res) => {
  try {
    const collection = await prisma.reviewCollection.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: {
        _count: {
          select: { reviews: true },
        },
      },
    });

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    res.json({
      ...collection,
      reviewCount: collection._count.reviews,
    });
  } catch (error) {
    logger.error('Failed to get collection status', error);
    res.status(500).json({ error: 'Failed to get collection status' });
  }
});

// List all collections
router.get('/collections', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [collections, total] = await Promise.all([
      prisma.reviewCollection.findMany({
        where: { userId: req.user.id },
        include: {
          _count: {
            select: { reviews: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.reviewCollection.count({
        where: { userId: req.user.id },
      }),
    ]);

    res.json({
      collections: collections.map(c => ({
        ...c,
        reviewCount: c._count.reviews,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Failed to list collections', error);
    res.status(500).json({ error: 'Failed to list collections' });
  }
});

// Get reviews from a collection
router.get(
  '/collections/:id/reviews',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sentiment').optional().isIn(['positive', 'negative', 'neutral']),
    query('source').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { page = 1, limit = 20, sentiment, source } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      // Build filter
      const where: any = {
        collectionId: req.params.id,
        collection: { userId: req.user.id },
      };

      if (sentiment) {
        where.sentimentLabel = sentiment;
      }

      if (source) {
        where.source = source;
      }

      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where,
          orderBy: { date: 'desc' },
          skip,
          take: Number(limit),
        }),
        prisma.review.count({ where }),
      ]);

      res.json({
        reviews,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Failed to get reviews', error);
      res.status(500).json({ error: 'Failed to get reviews' });
    }
  }
);

// Export reviews as CSV
router.get('/collections/:id/export', async (req, res) => {
  try {
    const collection = await prisma.reviewCollection.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const reviews = await prisma.review.findMany({
      where: { collectionId: collection.id },
      orderBy: { date: 'desc' },
    });

    // Generate CSV
    const csv = [
      'Review ID,Author,Rating,Date,Source,Sentiment,Content',
      ...reviews.map(r => 
        `"${r.id}","${r.author}",${r.rating},"${r.date.toISOString()}","${r.source}","${r.sentimentLabel}","${r.content.replace(/"/g, '""')}"`
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="reviews-${collection.businessName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Failed to export reviews', error);
    res.status(500).json({ error: 'Failed to export reviews' });
  }
});

// Get review analytics
router.get('/collections/:id/analytics', async (req, res) => {
  try {
    const collection = await prisma.reviewCollection.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Get analytics data
    const [
      totalReviews,
      sentimentDistribution,
      ratingDistribution,
      sourceDistribution,
      timeSeriesData,
    ] = await Promise.all([
      prisma.review.count({ where: { collectionId: collection.id } }),
      
      prisma.review.groupBy({
        by: ['sentimentLabel'],
        where: { collectionId: collection.id },
        _count: true,
      }),
      
      prisma.review.groupBy({
        by: ['rating'],
        where: { collectionId: collection.id },
        _count: true,
      }),
      
      prisma.review.groupBy({
        by: ['source'],
        where: { collectionId: collection.id },
        _count: true,
      }),
      
      // Get monthly trend
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', date) as month,
          AVG(rating) as avg_rating,
          COUNT(*) as review_count
        FROM reviews
        WHERE collection_id = ${collection.id}
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `,
    ]);

    res.json({
      summary: {
        totalReviews,
        averageRating: await prisma.review.aggregate({
          where: { collectionId: collection.id },
          _avg: { rating: true },
        }).then(r => r._avg.rating),
        collectionDate: collection.createdAt,
      },
      sentimentDistribution: sentimentDistribution.reduce((acc, item) => {
        acc[item.sentimentLabel] = item._count;
        return acc;
      }, {} as Record<string, number>),
      ratingDistribution: ratingDistribution.reduce((acc, item) => {
        acc[item.rating] = item._count;
        return acc;
      }, {} as Record<number, number>),
      sourceDistribution: sourceDistribution.reduce((acc, item) => {
        acc[item.source] = item._count;
        return acc;
      }, {} as Record<string, number>),
      timeSeriesData,
    });
  } catch (error) {
    logger.error('Failed to get analytics', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});