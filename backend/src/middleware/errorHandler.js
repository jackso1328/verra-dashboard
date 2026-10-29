const errorHandler = (err, req, res, next) => {
  console.error(`💥 [VÉRRA Error] ${req.method} ${req.url}:`, err);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;
