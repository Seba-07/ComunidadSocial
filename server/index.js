import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Security middleware
import {
  generalLimiter,
  securityHeaders,
  sanitizeInput,
  largeBodyParser
} from './middleware/security.js';

// Routes
import authRoutes from './routes/auth.js';
import organizationsRoutes from './routes/organizations.js';
import ministrosRoutes from './routes/ministros.js';
import assignmentsRoutes from './routes/assignments.js';
import notificationsRoutes from './routes/notifications.js';
import usersRoutes from './routes/users.js';
import unidadesVecinalesRoutes from './routes/unidadesVecinales.js';
import guiaConstitucionRoutes from './routes/guiaConstitucion.js';
import libraryDocumentsRoutes from './routes/libraryDocuments.js';
import newsRoutes from './routes/news.js';
import estatutoTemplatesRoutes from './routes/estatutoTemplates.js';
import organizationTypesRoutes from './routes/organizationTypes.js';
import documentsRoutes from './routes/documents.js';
import dashboardRoutes from './routes/dashboard.js';
import auditLogRoutes from './routes/auditLog.js';
import searchRoutes from './routes/search.js';
import orgDocumentsRoutes from './routes/organizationDocuments.js';
import ministroBlocksRoutes from './routes/ministroBlocks.js';
import adminPreferencesRoutes from './routes/adminPreferences.js';
import securityIncidentsRoutes from './routes/securityIncidents.js';
import documentTemplatesRoutes from './routes/documentTemplates.js';
import documentRegistryRoutes from './routes/documentRegistry.js';
import tenantRoutes from './routes/tenant.js';

// Auto-migration system
import { autoMigrateOrganizations } from './scripts/auto-migration.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Detectar entorno desplegado (Railway, etc.)
const isDeployed = process.env.NODE_ENV === 'production' ||
                   !!process.env.RAILWAY_ENVIRONMENT ||
                   !!process.env.RAILWAY_PROJECT_ID;

// SEGURIDAD: Trust proxy para que req.ip sea el IP real (no el del proxy Railway/Vercel)
app.set('trust proxy', 1);

// Middleware — CORS dinámico según entorno
const isProduction = process.env.NODE_ENV === 'production' || isDeployed;

function buildAllowedOrigins() {
  const origins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ];
  if (process.env.FRONTEND_URL) origins.push(process.env.FRONTEND_URL);
  if (process.env.FRONTEND_URL_ALT) origins.push(process.env.FRONTEND_URL_ALT);
  return origins;
}

const allowedOrigins = buildAllowedOrigins();

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Aceptar cualquier *.vercel.app (previews y producción)
    // Seguro: el dominio vercel.app es controlado por Vercel
    if (/^https:\/\/.*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    // SEGURIDAD: Rechazar orígenes no permitidos
    console.warn('CORS blocked origin:', origin);
    callback(new Error('No permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Cookie parser para JWT HttpOnly cookies
app.use(cookieParser());

// ============ COMPRESSION (reduce ~70% network traffic) ============
app.use(compression({
  level: 6, // Balance entre velocidad y compresión
  threshold: 1024, // Solo comprimir respuestas > 1KB
  filter: (req, res) => {
    // No comprimir si el cliente no soporta
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Headers de seguridad (Helmet)
app.use(securityHeaders);

// Rate limiting global
app.use('/api/', generalLimiter);

// Body parsing — 5MB default, rutas específicas usan largeBodyParser para 50MB
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Sanitización de inputs (DESPUÉS de body parsing para que req.body exista)
app.use(sanitizeInput);

// CSRF protection: rutas mutadoras requieren header X-Requested-With
app.use('/api/', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Excluir rutas que no pueden enviar custom headers (CSP reports, webhooks)
    const exempt = ['/api/health', '/api/csp-report'];
    if (exempt.some(path => req.originalUrl.startsWith(path))) return next();

    const xrw = req.headers['x-requested-with'];
    if (!xrw || xrw !== 'XMLHttpRequest') {
      return res.status(403).json({ error: 'Forbidden: missing CSRF header' });
    }
  }
  next();
});

// Servir archivos estáticos de uploads con cache headers
app.use('/uploads', express.static('uploads', {
  maxAge: '1d', // Cache por 1 día
  etag: true,
  lastModified: true
}));

// MongoDB Connection (skip in test - tests manage their own connection)
if (process.env.NODE_ENV !== 'test') {
  const MONGODB_URI = process.env.MONGODB_URI || (
    isDeployed
      ? (() => { console.error('FATAL: MONGODB_URI is required in deployed environments.'); process.exit(1); })()
      : 'mongodb://localhost:27017/comunidad_social_dev'
  );
  mongoose.connect(MONGODB_URI)
    .then(async () => {
      console.log(`Connected to MongoDB: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***:***@')}`);
      await autoMigrateOrganizations();
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err);
    });
}

// Large body parser para rutas que reciben certificados/documentos base64
// Estas rutas necesitan hasta 50MB (certificados base64 del wizard)
app.use('/api/organizations', largeBodyParser);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/ministros', ministrosRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/unidades-vecinales', unidadesVecinalesRoutes);
app.use('/api/guia-constitucion', guiaConstitucionRoutes);
app.use('/api/library-documents', libraryDocumentsRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/estatuto-templates', estatutoTemplatesRoutes);
app.use('/api/organization-types', organizationTypesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/org-documents', orgDocumentsRoutes);
app.use('/api/ministro-blocks', ministroBlocksRoutes);
app.use('/api/admin-preferences', adminPreferencesRoutes);
app.use('/api/security-incidents', securityIncidentsRoutes);
app.use('/api/document-templates', documentTemplatesRoutes);
app.use('/api/document-registry', documentRegistryRoutes);
app.use('/api/tenant', tenantRoutes);

// CSP violation report endpoint (no auth required)
app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body?.['csp-report'] || req.body;
  if (report) {
    console.warn('CSP Violation:', JSON.stringify({
      blockedURI: report['blocked-uri'],
      violatedDirective: report['violated-directive'],
      documentURI: report['document-uri']
    }));
  }
  res.status(204).end();
});

// Health check
app.get('/api/health', async (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoLabels = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  const health = {
    status: mongoState === 1 ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    mongodb: mongoLabels[mongoState] || 'unknown',
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
      heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
    }
  };

  // Include DB stats if connected and ?details=true
  if (mongoState === 1 && req.query.details === 'true') {
    try {
      const dbStats = await mongoose.connection.db.stats();
      health.db = {
        collections: dbStats.collections,
        dataSize: (dbStats.dataSize / 1024 / 1024).toFixed(2) + ' MB',
        indexSize: (dbStats.indexSize / 1024 / 1024).toFixed(2) + ' MB',
        objects: dbStats.objects
      };
    } catch { /* ignore */ }
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log completo en servidor (nunca al cliente)
  console.error('=== GLOBAL ERROR HANDLER ===');
  console.error('Route:', req.method, req.originalUrl);
  console.error('Error:', err.name, '-', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error('Stack:', err.stack);
  }

  // Payload too large (body exceeds express.json limit)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'El tamaño de los datos excede el límite permitido. Intente con archivos más pequeños.'
    });
  }

  // JSON syntax error
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Error en el formato de los datos enviados'
    });
  }

  // SEGURIDAD: nunca filtrar detalles internos al cliente en producción
  const isProduction = process.env.NODE_ENV === 'production' || isDeployed;
  res.status(500).json({
    error: 'Error interno del servidor',
    ...(isProduction ? {} : { message: err.message, errorName: err.name })
  });
});

// Only start listening when not imported by tests
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // ============ TIMEOUTS DE CONEXIÓN ============
  server.setTimeout(30000);
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

export default app;
