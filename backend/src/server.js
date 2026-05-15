// src/server.js
const express      = require('express');
const cors         = require('cors');
const dotenv       = require('dotenv');

dotenv.config({ override: true });

const connectDB    = require('./config/db');
const initSocket   = require('./config/socket');
const errorHandler = require('./middleware/errorHandler');
const seedDatabase = require('./utils/seedData');

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:8080',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ──────────────────────────────────────────────────
app.use('/api/v1/auth',      require('./routes/authRoutes'));
app.use('/api/v1/disasters', require('./routes/disasterRoutes'));
app.use('/api/v1/sos',       require('./routes/sosRoutes'));
app.use('/api/v1/social',    require('./routes/socialRoutes'));
app.use('/api/v1/shelters',  require('./routes/shelterRoutes'));
app.use('/api/v1/resources', require('./routes/resourceRoutes'));
app.use('/api/v1/alerts',    require('./routes/alertRoutes'));
app.use('/api/v1/routes',    require('./routes/rescueRoutes'));

// ── Health Check ────────────────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  res.json({
    status:    'OK',
    service:   'RESQAI Backend',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),
  });
});

// ── 404 ────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` }));

// ── Global Error Handler ────────────────────────────────────
app.use(errorHandler);

// ── Start ───────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();

  // Auto-seed demo data if DB is empty
  await seedDatabase();

  const PORT   = process.env.PORT || 5000;
  const server = app.listen(PORT, () =>
    console.log(`🚀 RESQAI backend running → http://localhost:${PORT}/api/v1/health`)
  );
  initSocket(server);
};

startServer();