export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(' ') });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid id.' });
  }
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong on the server.' });
}
