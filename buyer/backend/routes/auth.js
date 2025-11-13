/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: User authentication and account management
 *
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthRegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and get JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthLoginRequest'
 *     responses:
 *       200:
 *         description: Login success, returns JWT token
 *
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get authenticated user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */


import express from 'express';
import { body } from 'express-validator';
 // use your auth middleware
import { updateProfile } from '../controllers/auth.js';
import { sendPhoneOtp, verifyPhoneOtp } from '../controllers/auth.js';
import {
  register,
  login,
  googleAuth,
  getMe,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  setOnlineStatus,
} from '../controllers/auth.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please include a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please include a valid email'),
    body('password').exists().withMessage('Password is required'),
  ],
  login
);

router.post('/google', googleAuth);
router.get('/me', protect, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.patch('/online', protect, setOnlineStatus);
router.patch('/me', protect, updateProfile);
router.patch('/me', protect, updateProfile);
router.post('/send-phone-otp', protect, sendPhoneOtp);
router.post('/verify-phone-otp', protect, verifyPhoneOtp);

export default router;