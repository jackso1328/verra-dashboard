const app = require('./src/app');
const env = require('./src/config/env');
const { connectDB } = require('./src/config/db');

const startServer = async () => {
  // Connect to MongoDB Atlas / Local MongoDB
  await connectDB();

  const server = app.listen(env.PORT, () => {
    console.log(`\n🌿 [VÉRRA Backend] Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`📡 Health Check: http://localhost:${env.PORT}/api/health`);
    console.log(`✨ Storefront Catalog: http://localhost:${env.PORT}/api/products\n`);
  });

  // Handle Unhandled Rejections
  process.on('unhandledRejection', (err) => {
    console.error(`💥 Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
};

startServer();
