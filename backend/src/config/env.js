require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/verra_bi',
  DB_NAME: process.env.DB_NAME || 'verra_bi',
  JWT_SECRET: process.env.JWT_SECRET || 'verra_luxury_secret_jwt_key_2026_botanical',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || '*'
};
