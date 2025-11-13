/**
 * @openapi
 * tags:
 *   - name: Parking
 *     description: Parking space management
 *
 * /api/parking:
 *   get:
 *     tags: [Parking]
 *     summary: Get all parking spaces
 *
 * /api/parking/my-spaces:
 *   get:
 *     tags: [Parking]
 *     security:
 *       - bearerAuth: []
 *     summary: Get the parking spaces owned by logged in user
 *
 * /api/parking/{id}:
 *   get:
 *     tags: [Parking]
 *     summary: Get parking space by ID
 */


import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  registerParkingSpace,
  updateParkingSpace,
  deleteParkingSpace,
  getParkingSpaces,
  getParkingSpaceById,
  getMyParkingSpaces,
  getParkingSpaceAvailability,
  setOnlineStatus,
} from '../controllers/parking.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Use memory storage so files are available as buffers (req.files[].buffer)
const storage = multer.memoryStorage();

// Accept only images; prevents Multer errors that can drop body fields
const fileFilter = (req, file, cb) => {
  if (/^image\//.test(file.mimetype)) return cb(null, true);
  return cb(new Error('Only image uploads are allowed'));
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const router = express.Router();

router.post('/', protect, upload.array('photos', 5), registerParkingSpace);
router.put('/:id', protect, upload.array('photos', 5), updateParkingSpace);

// Specific routes before parameterized ones
router.get('/my-spaces', protect, getMyParkingSpaces);
router.get('/:id/availability', protect, getParkingSpaceAvailability);
router.get('/:id', getParkingSpaceById);

// New route: toggle per-space online status
router.patch('/:id/online', protect, setOnlineStatus);

router.delete('/:id', protect, deleteParkingSpace);
router.get('/', getParkingSpaces);

export default router;