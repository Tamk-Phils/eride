import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import authRoutes from './routes/auth.routes.js';
import rideRoutes from './routes/ride.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import chatRoutes from './routes/chat.routes.js';
import adminRoutes from './routes/admin.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { errorHandler } from './middleware/error.js';
import { initCronJobs } from './jobs/cron.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/rides/:rideId/messages', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Serve Admin Portal
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use(errorHandler);

// In-memory store for active drivers
export const activeDrivers = new Map<string, { lat: number, lng: number, type: string, lastUpdated: number }>();

io.on('connection', (socket: Socket) => {
  console.log('Socket connected:', socket.id);
  
  // Store the driver's userId for cleanup
  let currentDriverId: string | null = null;

  socket.on('join_user', (userId: string) => {
    if (userId) {
      socket.join(userId);
      console.log(`Socket ${socket.id} joined user room ${userId}`);
    }
  });

  socket.on('join_ride', (rideId: string) => {
    if (rideId) {
      socket.join(`ride:${rideId}`);
      console.log(`Socket ${socket.id} joined ride room ${rideId}`);
    }
  });

  socket.on('leave_ride', (rideId: string) => {
    if (rideId) {
      socket.leave(`ride:${rideId}`);
      console.log(`Socket ${socket.id} left ride room ${rideId}`);
    }
  });

  socket.on('update_location', (data: { driverId: string, lat: number, lng: number, type: string }) => {
    if (data.driverId) {
      console.log(`[Driver ${data.driverId}] Location update: ${data.lat}, ${data.lng}`);
      currentDriverId = data.driverId;
      activeDrivers.set(data.driverId, {
        lat: data.lat,
        lng: data.lng,
        type: data.type || 'STANDARD',
        lastUpdated: Date.now()
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    if (currentDriverId) {
      activeDrivers.delete(currentDriverId);
    }
  });
});

// Broadcast available drivers to all users every 3 seconds
setInterval(() => {
  const now = Date.now();
  const drivers = Array.from(activeDrivers.entries()).map(([id, data]) => {
    // Optional: Clean up stale drivers who haven't updated in 30 seconds
    if (now - data.lastUpdated > 30000) {
      activeDrivers.delete(id);
      return null;
    }
    return { id, lat: data.lat, lng: data.lng, type: data.type };
  }).filter(Boolean);

  if (drivers.length > 0) {
    io.emit('available_drivers', drivers);
  }
}, 3000);

// Initialize Cron Jobs
initCronJobs();

const PORT = process.env['PORT'] || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
