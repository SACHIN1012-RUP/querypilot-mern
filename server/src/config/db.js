import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let memoryServer = null;

// Placeholder text copied from instructions must not be treated as a real URI.
const isPlaceholder = (uri) => !uri || /[<>]|USERNAME|PASSWORD|xxxxx/i.test(uri);

async function startBuiltInMongo() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const dbPath = path.resolve(__dirname, '../../.data/db');
  fs.mkdirSync(dbPath, { recursive: true });
  console.log('Starting built-in MongoDB. The first run can take a minute while it is prepared...');
  memoryServer = await MongoMemoryServer.create({
    binary: { version: process.env.MONGOMS_VERSION || '7.0.14' },
    instance: { dbName: 'querypilot', dbPath, storageEngine: 'wiredTiger' },
  });
  return memoryServer.getUri('querypilot');
}

export async function connectDB() {
  mongoose.set('strictQuery', true);
  const configured = (process.env.MONGO_URI || '').trim();

  if (!isPlaceholder(configured)) {
    try {
      await mongoose.connect(configured, { serverSelectionTimeoutMS: 8000 });
      console.log('MongoDB connected (using your MONGO_URI)');
      return 'external';
    } catch (err) {
      console.warn(`Could not connect to your MONGO_URI: ${err.message}`);
      console.warn('Falling back to the built-in database so the app still works.');
    }
  }

  const uri = await startBuiltInMongo();
  await mongoose.connect(uri);
  console.log('MongoDB connected (built-in database, data saved in server/.data)');
  return 'built-in';
}

export async function closeDB() {
  try {
    await mongoose.disconnect();
    if (memoryServer) await memoryServer.stop({ doCleanup: false });
  } catch {
    /* shutting down anyway */
  }
}
