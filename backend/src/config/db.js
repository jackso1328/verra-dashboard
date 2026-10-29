const mongoose = require('mongoose');
const dns = require('dns');
const env = require('./env');

// Ensure reliable SRV resolution on Windows environments
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Use system default if setServers is restricted
}

let isConnected = false;

const connectDB = async () => {
  if (!env.MONGODB_URI) {
    console.warn('\n⚠️ [VÉRRA Backend] MONGODB_URI is not defined in environment.');
    console.warn('👉 Please configure your MongoDB Atlas connection string in backend/.env:');
    console.warn('   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/verra_bi?retryWrites=true&w=majority\n');
    return false;
  }

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      dbName: env.DB_NAME,
      serverSelectionTimeoutMS: 5000 // Quick fail if local or cluster is unreachable
    });
    isConnected = true;
    console.log(`✨ [VÉRRA Backend] MongoDB Connected successfully to host: ${conn.connection.host} (Database: ${env.DB_NAME})`);
    return true;
  } catch (error) {
    isConnected = false;
    console.error('\n⚠️ [VÉRRA Backend] MongoDB Connection Error:');
    console.error(`   ${error.message}`);
    console.warn('\n👉 To connect to MongoDB Atlas:');
    console.warn('   1. Create a free cluster at https://www.mongodb.com/cloud/atlas');
    console.warn('   2. Add your IP to the Atlas Network Access whitelist');
    console.warn('   3. Set MONGODB_URI in backend/.env and restart server or run `npm run seed`.\n');
    return false;
  }
};

const getDBStatus = () => {
  return {
    connected: isConnected && mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    readyStateDescription: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
    database: env.DB_NAME,
    host: isConnected ? mongoose.connection.host : null
  };
};

module.exports = { connectDB, getDBStatus };
