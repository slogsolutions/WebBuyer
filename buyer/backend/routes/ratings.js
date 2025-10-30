// backend/routes/ratings.js
import express from 'express';
import { protect } from '../middleware/auth.js';
import { createRating, getRatingsForUser,getRatingsForParking } from '../controllers/rating.js';

const router = express.Router();

router.post('/', protect, createRating);
router.get('/user/:userId', protect, getRatingsForUser);
router.get('/parking/:parkingSpaceId', getRatingsForParking);




export default router;
 