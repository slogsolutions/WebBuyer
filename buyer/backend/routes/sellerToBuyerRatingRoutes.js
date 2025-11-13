/**
 * @openapi
 * tags:
 *   - name: Seller→Buyer Rating
 *
 * /api/seller-rating/rate-buyer:
 *   post:
 *     tags: [Seller→Buyer Rating]
 *     security:
 *       - bearerAuth: []
 *     summary: Rate a buyer
 *
 * /api/seller-rating/buyer-rating/{buyerId}:
 *   get:
 *     tags: [Seller→Buyer Rating]
 *     summary: Get buyer rating
 *
 * /api/seller-rating/buyer-comments/{buyerId}:
 *   get:
 *     tags: [Seller→Buyer Rating]
 *     summary: Get comments for a buyer
 */


import express from "express";
import { protect } from "../middleware/auth.js";
import { rateBuyer, getBuyerRating, getBuyerComments } from "../controllers/sellerToBuyerRatingController.js";

const router = express.Router();

router.post("/rate-buyer", protect, rateBuyer);
router.get("/buyer-rating/:buyerId", getBuyerRating);
router.get("/buyer-comments/:buyerId", getBuyerComments);

export default router;
