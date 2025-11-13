// index.js
// ------------------------------
// Core imports
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import multer from 'multer';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// App internals
import connectDB from './config/db.js';
import { startBookingReminderCron } from './cronjob.js';
import { protect } from './middleware/auth.js';

// Route modules
import authRoutes from './routes/auth.js';
import kycRoutes from './routes/kyc.js';
import parkingRoutes from './routes/parking.js';
import bookingRoutes from './routes/booking.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';
import userTokensRouter from './routes/userTokenRoutes.js';
import captainRoutes from './routes/captain.js';
import ratingRoutes from './routes/ratings.js';
import dashboardRoutes from './routes/dashboard.js';
import sellerToBuyerRatingRoutes from './routes/sellerToBuyerRatingRoutes.js';

// Models used by socket handlers
import ParkfindersecondParkingSpace from './models/ParkingSpace.js';
import ParkFinderSecondUser from './models/User.js';

// Swagger
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';

// ------------------------------
// Environment
dotenv.config();

// Basic runtime checks (non-sensitive logging)
const hasMongo = !!process.env.MONGODB_URI;
const hasClient = !!process.env.CLIENT_ID;
console.log('ENV check: MONGODB_URI set?', hasMongo, 'CLIENT_ID set?', hasClient);

if (!hasMongo) {
  console.error('ERROR: MONGODB_URI is not set. Please add server/.env with MONGODB_URI.');
}

// ------------------------------
// Database
try {
  // connectDB should read process.env.MONGODB_URI internally
  connectDB();
} catch (err) {
  console.error('connectDB() threw an error:', err);
}

// ------------------------------
// Allowed CORS origins
const AllowedOrigin = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_DEV_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://apark-phi.vercel.app',
  '*',
].filter(Boolean);

// ------------------------------
// App + HTTP server + Socket.IO
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

// ------------------------------
// Middleware
// CORS first
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

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// (Keep a second json parser for compatibility with older code)
app.use(express.json());

// Static uploads
const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

// ------------------------------
// Swagger (MUST be before route mounts)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
console.log('✅ Swagger UI -> http://localhost:5000/api-docs');

// ------------------------------
// Health check & meta
app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    env: process.env.NODE_ENV || 'development',
    mongoConnected: mongoose.connection.readyState === 1,
    time: new Date().toISOString(),
  });
});

// ------------------------------
// Routes
app.use('/api/users', userTokensRouter);
app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/parking', parkingRoutes);

// Booking routes (keep both singular/plural for older clients)
app.use('/api/booking', bookingRoutes);
app.use('/api/bookings', bookingRoutes);

app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/captain', captainRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Ratings
app.use('/api/ratings', ratingRoutes);
app.use('/api/seller-rating', sellerToBuyerRatingRoutes);

// ------------------------------
// Multer (initialize ONLY if/when needed for multipart endpoints)
const upload = multer();

// ------------------------------
// Simple test + helper
app.get('/test', (req, res) => {
  res.send({ test: 'done' });
});

app.get('/proxy/new-reference', (req, res) => {
  res.json({ reference_id: uuidv4() });
});

// ------------------------------
// Socket.IO logic
const connectedProviders = {};

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('register-provider', async (data) => {
    try {
      console.log('Registering provider:', data?.userId);
      if (!data?.userId) return;
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
      const { userLat, userLng, userId } = data || {};
      if (
        typeof userLat !== 'number' ||
        typeof userLng !== 'number'
      ) {
        console.warn('notify-nearby-providers: invalid coordinates', data);
        return;
      }

      const nearbySpaces = await ParkfindersecondParkingSpace.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [userLng, userLat] },
            distanceField: 'distance',
            maxDistance: 200000, // 200 km
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
            parkingSpaceId: nearestParkingSpace?._id,
            distance: nearestParkingSpace?.distance,
          });
        }
      });
    } catch (error) {
      console.error('Error notifying nearby providers:', error);
    }
  });

  socket.on('accept-parking-request', (requestData) => {
    try {
      if (!requestData?.providerId) return;
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
    try {
      Object.keys(connectedProviders).forEach((providerId) => {
        if (connectedProviders[providerId] === socket.id) {
          delete connectedProviders[providerId];
          console.log('Provider disconnected:', providerId);
        }
      });
    } catch (e) {
      console.error('disconnect cleanup error:', e);
    }
  });
});

// ------------------------------
// 404 and error handlers (kept minimal & safe)
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '') {
    // Helpful landing
    return res.status(200).send(
      `<div style="font-family: system-ui, Arial; padding: 24px">
        <h2>Carfour backend is running ✅</h2>
        <p>Open <a href="/api-docs">/api-docs</a> for Swagger UI.</p>
      </div>`
    );
  }
  return res.status(404).json({ message: 'Not Found', path: req.path });
});

// Centralized error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Server Error',
    status,
  });
});

// ------------------------------
// Server start
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// ------------------------------
// Cron job bootstrap
try {
  startBookingReminderCron();
} catch (e) {
  console.error('Failed to start cron job:', e);
}
