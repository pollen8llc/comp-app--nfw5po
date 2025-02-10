import { Router, Request, Response, NextFunction } from 'express'; // v4.18.2
import rateLimit from 'express-rate-limit'; // v6.7.0
import compression from 'compression'; // v1.7.4
import { MetricsService } from '@opentelemetry/api'; // v1.4.0
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/request-validator';
import { RedisService } from '../services/redis.service';
import { logger } from '../utils/logger';
import { ERROR_CODES } from '../../../shared/utils/error-codes';
import { sendSuccess, sendError } from '../utils/response';

// Constants
const CACHE_TTL = 3600;
const CACHE_PREFIX = 'event:';
const RATE_LIMIT_WINDOW = 900000; // 15 minutes
const RATE_LIMIT_MAX = 100;

// Initialize router
const router = Router();

// Initialize services
const redisService = RedisService.getInstance();
const metrics = new MetricsService('event_routes');

// Event validation schemas
const createEventSchema = {
  name: 'string',
  date: 'date',
  platform: 'string',
  metadata: 'object?'
};

const importEventSchema = {
  source: 'string',
  data: 'array'
};

/**
 * Create new event with validation and caching
 * @route POST /api/v1/events
 */
router.post(
  '/',
  authenticate,
  authorize(['admin', 'event_manager']),
  validateRequest(createEventSchema),
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    try {
      // Record metrics
      metrics.startSpan('create_event');

      // Validate request body
      const eventData = req.body;

      // Create event through service
      const response = await fetch('http://event-service/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      const createdEvent = await response.json();

      // Cache event data
      await redisService.setCache(
        `${CACHE_PREFIX}${createdEvent.id}`,
        createdEvent,
        CACHE_TTL
      );

      // Record success metrics
      metrics.recordMetric('event_creation_success', 1);
      metrics.recordLatency('event_creation_duration', Date.now() - startTime);

      logger.info('Event created successfully', {
        eventId: createdEvent.id,
        requestId,
        duration: Date.now() - startTime
      });

      sendSuccess(res, createdEvent, {
        requestId,
        timestamp: Date.now(),
        monitoring: {
          duration: Date.now() - startTime
        }
      });

    } catch (error) {
      // Record error metrics
      metrics.recordMetric('event_creation_error', 1);
      
      logger.error('Failed to create event', {
        error,
        requestId,
        duration: Date.now() - startTime
      });

      sendError(res, error, {
        code: ERROR_CODES.EVENT_IMPORT_ERROR,
        requestId
      });
    } finally {
      metrics.endSpan();
    }
  }
);

/**
 * Import events from external platforms
 * @route POST /api/v1/events/import
 */
router.post(
  '/import',
  authenticate,
  authorize(['admin', 'event_manager']),
  validateRequest(importEventSchema),
  compression(),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    try {
      metrics.startSpan('import_events');

      const { source, data } = req.body;

      // Import events through service
      const response = await fetch('http://event-service/events/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization
        },
        body: JSON.stringify({ source, data })
      });

      if (!response.ok) {
        throw new Error('Failed to import events');
      }

      const importedEvents = await response.json();

      // Cache imported events
      await Promise.all(
        importedEvents.map(event => 
          redisService.setCache(
            `${CACHE_PREFIX}${event.id}`,
            event,
            CACHE_TTL
          )
        )
      );

      metrics.recordMetric('event_import_success', importedEvents.length);
      metrics.recordLatency('event_import_duration', Date.now() - startTime);

      logger.info('Events imported successfully', {
        source,
        count: importedEvents.length,
        requestId,
        duration: Date.now() - startTime
      });

      sendSuccess(res, importedEvents, {
        requestId,
        timestamp: Date.now(),
        monitoring: {
          duration: Date.now() - startTime
        }
      });

    } catch (error) {
      metrics.recordMetric('event_import_error', 1);

      logger.error('Failed to import events', {
        error,
        requestId,
        duration: Date.now() - startTime
      });

      sendError(res, error, {
        code: ERROR_CODES.EVENT_IMPORT_ERROR,
        requestId
      });
    } finally {
      metrics.endSpan();
    }
  }
);

/**
 * Get event by ID with caching
 * @route GET /api/v1/events/:id
 */
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;
    const eventId = req.params.id;

    try {
      metrics.startSpan('get_event');

      // Check cache first
      const cachedEvent = await redisService.getCache(`${CACHE_PREFIX}${eventId}`);
      if (cachedEvent) {
        metrics.recordMetric('event_cache_hit', 1);
        return sendSuccess(res, cachedEvent, {
          requestId,
          timestamp: Date.now(),
          monitoring: {
            duration: Date.now() - startTime
          }
        });
      }

      // Fetch from service if not cached
      const response = await fetch(`http://event-service/events/${eventId}`, {
        headers: {
          'Authorization': req.headers.authorization
        }
      });

      if (!response.ok) {
        throw new Error('Event not found');
      }

      const event = await response.json();

      // Cache the result
      await redisService.setCache(
        `${CACHE_PREFIX}${eventId}`,
        event,
        CACHE_TTL
      );

      metrics.recordMetric('event_retrieval_success', 1);
      metrics.recordLatency('event_retrieval_duration', Date.now() - startTime);

      sendSuccess(res, event, {
        requestId,
        timestamp: Date.now(),
        monitoring: {
          duration: Date.now() - startTime
        }
      });

    } catch (error) {
      metrics.recordMetric('event_retrieval_error', 1);

      logger.error('Failed to retrieve event', {
        error,
        eventId,
        requestId,
        duration: Date.now() - startTime
      });

      sendError(res, error, {
        code: ERROR_CODES.NOT_FOUND_ERROR,
        requestId
      });
    } finally {
      metrics.endSpan();
    }
  }
);

export default router;