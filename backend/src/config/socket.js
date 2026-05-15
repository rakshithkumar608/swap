// src/config/socket.js
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', methods: ['GET','POST'] },
    transports: ['websocket', 'polling'],
  });

  // ── Auth middleware (skip for public clients) ────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) { socket.userId = null; socket.userRole = 'viewer'; return next(); }
    try {
      const decoded    = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId    = decoded.id;
      socket.userRole  = decoded.role;
      next();
    } catch {
      socket.userId    = null;
      socket.userRole  = 'viewer';
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`🟢 Client connected: ${socket.id} | role: ${socket.userRole}`);

    // All clients join general + responders room
    socket.join('all');
    if (socket.userRole === 'admin' || socket.userRole === 'responder') {
      socket.join('responders');
    }

    // ── Client → Server events ──────────────────────────────

    socket.on('join:disaster', (disasterId) => {
      socket.join(`disaster:${disasterId}`);
      console.log(`Socket ${socket.id} joined disaster:${disasterId}`);
    });

    socket.on('leave:disaster', (disasterId) => {
      socket.leave(`disaster:${disasterId}`);
    });

    socket.on('responder:location', ({ lat, lng }) => {
      if (socket.userRole === 'responder' || socket.userRole === 'admin') {
        io.to('responders').emit('responder:location', { userId: socket.userId, lat, lng, ts: Date.now() });
      }
    });

    socket.on('shelter:checkin', ({ shelterId, delta }) => {
      io.emit('shelter:update', { shelterId, delta, ts: Date.now() });
    });

    socket.on('route:request', ({ routeId }) => {
      socket.emit('route:ack', { routeId, message: 'Route update requested' });
    });

    socket.on('sos:send', (data) => {
      io.to('responders').emit('sos:new', { ...data, relay: true, ts: Date.now() });
    });

    socket.on('disconnect', () => {
      console.log(`🔴 Client disconnected: ${socket.id}`);
    });
  });

  global.io = io;
  return io;
};

module.exports = initSocket;