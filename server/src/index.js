import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { connectDB, closeDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import analyzeRoutes from './routes/analyze.js';
import { notFound, errorHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET) {
  if (isProd) {
    console.error('JWT_SECRET must be set in production.');
    process.exit(1);
  }
  process.env.JWT_SECRET = 'querypilot-dev-secret';
}

const app = express();
const limiterOpts = { standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false } };

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors({ origin: true }));
app.use(express.json({ limit: '200kb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) =>
  res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'not connected' })
);
app.use('/api/auth', rateLimit({ ...limiterOpts, windowMs: 15 * 60 * 1000, max: 200 }), authRoutes);
app.use('/api/analyze', rateLimit({ ...limiterOpts, windowMs: 60 * 1000, max: 60 }), analyzeRoutes);

// Serve the built React app when it exists (npm run build && npm start)
const dist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use('/api', notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 5001;

async function main() {
  await connectDB();
  const server = app.listen(port, '0.0.0.0', () => {
    console.log('');
    console.log('==================================================');
    console.log(` QueryPilot API is ready on http://localhost:${port}`);
    console.log(' Open the app at http://localhost:5173');
    console.log('==================================================');
  });
  server.on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Close the other QueryPilot terminal, or run: lsof -ti :${port} | xargs kill`);
    } else {
      console.error(err);
    }
    await closeDB();
    process.exit(1);
  });

  const shutdown = async () => {
    server.close();
    await closeDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(async (err) => {
  console.error('Startup failed:', err.message);
  await closeDB();
  process.exit(1);
});
