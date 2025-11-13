/**
 * @openapi
 * tags:
 *   - name: Ratings
 *     description: User ratings system
 *
 * /api/ratings:
 *   post:
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     summary: Create rating
 *
 * /api/ratings/user/{userId}:
 *   get:
 *     tags: [Ratings]
 *     summary: Get ratings for a user
 */


// backend/routes/ratings.js
import express from 'express';
import { protect } from '../middleware/auth.js';
import { createRating, getRatingsForUser,getRatingsForParking } from '../controllers/rating.js';

const router = express.Router();

router.post('/', protect, createRating);
router.get('/user/:userId', protect, getRatingsForUser);
router.get('/parking/:parkingSpaceId', getRatingsForParking);




export default router;
 