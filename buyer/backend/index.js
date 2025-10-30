import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import kycRoutes from './routes/kyc.js';
import parkingRoutes from './routes/parking.js';
import bookingRoutes from './routes/booking.js';
import paymentRoutes from './routes/payment.js';
import mongoose from 'mongoose';
import ParkfindersecondParkingSpace from './models/ParkingSpace.js';
import ParkFinderSecondUser from './models/User.js';
import multer from 'multer';
import axios from 'axios';
import adminRoutes from './routes/admin.js';
import { protect } from './middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { startBookingReminderCron } from './cronjob.js';
import userTokensRouter from './routes/userTokenRoutes.js';
import captainRoutes from './routes/captain.js';
import ratingRoutes from './routes/ratings.js';

dotenv.config();

// Basic runtime checks (non-sensitive logging)
const hasMongo = !!process.env.MONGODB_URI;
const hasClient = !!process.env.CLIENT_ID;
console.log('ENV check: MONGODB_URI set?', hasMongo, 'CLIENT_ID set?', hasClient);

if (!hasMongo) {
  console.error('ERROR: MONGODB_URI is not set. Please add server/.env with MONGODB_URI.');
}

// Connect DB (connectDB should read process.env.MONGODB_URI internally)
try {
  connectDB();
} catch (err) {
  console.error('connectDB() threw an error:', err);
}

const AllowedOrigin = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_DEV_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://apark-phi.vercel.app',
  '*',
].filter(Boolean);

// Create app + server + socket.io
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: AllowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});
app.set('io', io);
global.io = io;

// Middleware: CORS and body parsers MUST come before route mounts
app.use(
  cors({
    origin: (origin, cb) => {
      // allow all (*) or specific origins from AllowedOrigin array
      if (!origin || AllowedOrigin.includes('*') || AllowedOrigin.includes(origin)) return cb(null, true);
      return cb(new Error('CORS not allowed'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// JSON and urlencoded parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Use JSON parser for application/json bodies
app.use(express.json());
// Static uploads
const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Routes (mounted after middleware)
app.use('/api/users', userTokensRouter);
app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/parking', parkingRoutes);

// Booking routes
app.use('/api/booking', bookingRoutes);
app.use('/api/bookings', bookingRoutes); // plural alias for older frontend calls

app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/captain', captainRoutes);

// Ratings route (ensure body parser already applied)
app.use('/api/ratings', ratingRoutes);

// Only initialize multer for multipart endpoints (if you need)
const upload = multer();

// Test endpoint
app.get('/test', (req, res) => {
  res.send({ test: 'done' });
});

// Optional helper: server-generated reference_id (UUID)
app.get('/proxy/new-reference', (req, res) => {
  res.json({ reference_id: uuidv4() });
});

// Proxy endpoints (unchanged logic from original code) - keep as-is
// /proxy/send-otp, /proxy/validate-otp, /proxy/validate-RC
// For brevity I won't fully repeat them here: keep your existing implementations
// (but ensure they rely on req.body which is parsed above).

// Socket.IO logic (unchanged core behavior)
const connectedProviders = {};

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('register-provider', async (data) => {
    try {
      console.log('Registering provider:', data.userId);
      const provider = await ParkFinderSecondUser.findById(data.userId);
      if (!provider) {
        console.log('Provider not found:', data.userId);
        return;
      }
      connectedProviders[data.userId] = socket.id;
      console.log('Connected Providers:', connectedProviders);
    } catch (error) {
      console.error('Error registering provider:', error);
    }
  });

  socket.on('notify-nearby-providers', async (data) => {
    try {
      const { userLat, userLng, userId } = data;
      const nearbySpaces = await ParkfindersecondParkingSpace.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [userLng, userLat] },
            distanceField: 'distance',
            maxDistance: 200000,
            spherical: true,
          },
        },
        { $project: { owner: 1, distance: 1, _id: 1 } },
      ]);

      if (!nearbySpaces || nearbySpaces.length === 0) return;

      const providerIds = [...new Set(nearbySpaces.map((space) => String(space.owner)))];
      providerIds.forEach((providerId) => {
        const providerSocketId = connectedProviders[providerId];
        if (providerSocketId) {
          const nearestParkingSpace = nearbySpaces.find((space) => String(space.owner) === providerId);
          io.to(providerSocketId).emit('new-parking-request', {
            id: userId,
            location: { latitude: userLat, longitude: userLng },
            parkingSpaceId: nearestParkingSpace._id,
            distance: nearestParkingSpace.distance,
          });
        }
      });
    } catch (error) {
      console.error('Error notifying nearby providers:', error);
    }
  });

  socket.on('accept-parking-request', (requestData) => {
    try {
      io.to(`user-${requestData.providerId}`).emit('provider-accepted', {
        providerId: requestData.providerId,
        name: requestData.parkingSpaceId,
        location: requestData.providerLocation,
      });
    } catch (e) {
      console.error('accept-parking-request error:', e);
    }
  });

  socket.on('disconnect', () => {
    Object.keys(connectedProviders).forEach((providerId) => {
      if (connectedProviders[providerId] === socket.id) {
        delete connectedProviders[providerId];
        console.log('Provider disconnected:', providerId);
      }
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Start cron job outside socket handlers
try {
  startBookingReminderCron();
} catch (e) {
  console.error('Failed to start cron job:', e);
}
