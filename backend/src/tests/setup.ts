// Setup global de tests
// Se ejecuta antes de cada archivo de test

// Configurar zona horaria para tests
process.env.TZ = 'America/Guayaquil';

// Variables de entorno mínimas para tests
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_32chars_minimum_ok';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32chars_minimum_ok';
process.env.JWT_ACCESS_EXPIRY = '8h';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '3001';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX = '5';
