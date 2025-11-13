/**
 * @openapi
 * tags:
 *   - name: KYC
 *     description: KYC Verification APIs
 *
 * /api/kyc:
 *   post:
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     summary: Submit KYC documents
 *
 * /api/kyc/status:
 *   get:
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     summary: Get your KYC status
 *
 * /api/kyc/admin:
 *   get:
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     summary: Admin - Get all KYC submissions
 *
 * /api/kyc/admin/approve/{selectedKycId}:
 *   post:
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     summary: Admin - Approve a KYC submission
 */


import express from 'express';
import { adminOnly, protect } from '../middleware/auth.js';
import { submitKYC, getKYCStatus, getAllKYCSubmissions,approveKYCSubmission} from '../controllers/kyc.js';
import multer from 'multer';

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const router = express.Router();

router.post('/', protect, upload.single('idDocument'), submitKYC);
router.get('/status', protect, getKYCStatus);

router.get('/admin', protect,adminOnly, getAllKYCSubmissions);
// router.put('/admin/update-kyc-status',protect, updateKYCStatus);
router.post('/admin/approve/:selectedKycId', protect,approveKYCSubmission);

export default router;    