/**
 * @openapi
 * tags:
 *   - name: Dashboard
 *     description: Provider dashboard analytics
 *
 * /api/dashboard/provider-stats:
 *   get:
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     summary: Get booking and earning statistics
 */


import express from 'express';
import { protect } from '../middleware/auth.js';
import { getProviderStats } from '../controllers/dashboard.js';

const router = express.Router();

// Get provider dashboard statistics
router.get('/provider-stats', protect, getProviderStats);

export default router;
