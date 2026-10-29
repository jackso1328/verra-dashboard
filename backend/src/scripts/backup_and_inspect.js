const mongoose = require('mongoose');
const dns = require('dns');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const inspectAndBackup = async () => {
  try {
    if (!env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not set in environment.');
      process.exit(1);
    }

    console.log('Connecting to MongoDB Atlas (credentials hidden for security)...');
    
    // Connect to Atlas targeting explicitly DB_NAME
    const conn = await mongoose.connect(env.MONGODB_URI, {
      dbName: env.DB_NAME,
      serverSelectionTimeoutMS: 10000
    });

    const activeDb = conn.connection.db;
    const dbName = activeDb.databaseName;
    console.log(`Connected to cluster successfully.`);
    console.log(`Target Database Name: "${dbName}"`);

    // Verify it targets verra_bi
    if (dbName !== 'verra_bi') {
      console.error(`❌ Security Check Failed: Expected database "verra_bi", but connected to "${dbName}". Aborting.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    // List all collections in verra_bi
    const collectionsList = await activeDb.listCollections().toArray();
    console.log(`Collections found in "${dbName}":`, collectionsList.map(c => c.name));

    const targetCollections = ['products', 'users', 'orders', 'inventorymovements', 'expenses', 'reviews'];
    const backupData = {};
    const counts = {};

    for (const colName of targetCollections) {
      const exists = collectionsList.some(c => c.name === colName);
      if (exists) {
        const col = activeDb.collection(colName);
        const docs = await col.find({}).toArray();
        counts[colName] = docs.length;
        backupData[colName] = docs;
      } else {
        counts[colName] = 0;
        backupData[colName] = [];
      }
    }

    console.log('\n--- Existing Document Counts Before Reset ---');
    for (const [col, count] of Object.entries(counts)) {
      console.log(`  • ${col}: ${count} document(s)`);
    }

    // Save backup to disk
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupFile = path.join(backupDir, `backup_verra_bi_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf-8');

    console.log(`\n✅ Backup successfully saved to:`);
    console.log(`   ${backupFile}`);

    await mongoose.disconnect();
    console.log('Inspection and backup step completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during inspect and backup:', error.message);
    process.exit(1);
  }
};

inspectAndBackup();
