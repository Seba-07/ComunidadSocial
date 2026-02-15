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
  sanitizeInput
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

// Model for auto-migration
import Organization from './models/Organization.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://comunidad-social.vercel.app',
  'https://comunidadsocial.vercel.app'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // SEGURIDAD: Rechazar orígenes no permitidos
      console.warn('CORS blocked origin:', origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Body parsing con límites reducidos (previene DDoS)
// NOTA: 10MB es suficiente para la mayoría de operaciones
// Para uploads de archivos grandes, usar rutas específicas con multer
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Sanitización de inputs (DESPUÉS de body parsing para que req.body exista)
app.use(sanitizeInput);

// Servir archivos estáticos de uploads con cache headers
app.use('/uploads', express.static('uploads', {
  maxAge: '1d', // Cache por 1 día
  etag: true,
  lastModified: true
}));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social';

// Auto-migration function for existing organizations
async function autoMigrateOrganizations() {
  try {
    const organizations = await Organization.find({});
    let migratedCount = 0;

    for (const org of organizations) {
      let updated = false;

      // Migrar provisionalDirectorio si esta vacio
      if (!org.provisionalDirectorio?.president && !org.provisionalDirectorio?.secretary && !org.provisionalDirectorio?.treasurer) {
        const president = org.members?.find(m => m.role === 'president');
        const secretary = org.members?.find(m => m.role === 'secretary');
        const treasurer = org.members?.find(m => m.role === 'treasurer');

        if (president || secretary || treasurer) {
          org.provisionalDirectorio = {
            president: president ? { rut: president.rut, firstName: president.firstName, lastName: president.lastName } : null,
            secretary: secretary ? { rut: secretary.rut, firstName: secretary.firstName, lastName: secretary.lastName } : null,
            treasurer: treasurer ? { rut: treasurer.rut, firstName: treasurer.firstName, lastName: treasurer.lastName } : null,
            designatedAt: new Date(),
            type: 'PROVISIONAL'
          };
          updated = true;
        }
      }

      // Migrar electoralCommission si esta vacio
      if (!org.electoralCommission || org.electoralCommission.length === 0) {
        let commissionMembers = org.members?.filter(m => m.role === 'electoral_commission') || [];

        if (commissionMembers.length === 0) {
          const usedRuts = new Set();
          if (org.provisionalDirectorio?.president?.rut) usedRuts.add(org.provisionalDirectorio.president.rut);
          if (org.provisionalDirectorio?.secretary?.rut) usedRuts.add(org.provisionalDirectorio.secretary.rut);
          if (org.provisionalDirectorio?.treasurer?.rut) usedRuts.add(org.provisionalDirectorio.treasurer.rut);

          commissionMembers = org.members?.filter(m =>
            !usedRuts.has(m.rut) &&
            ['director', 'member', 'electoral_commission'].includes(m.role)
          ).slice(0, 3) || [];
        }

        if (commissionMembers.length > 0) {
          org.electoralCommission = commissionMembers.map(m => ({
            rut: m.rut,
            firstName: m.firstName,
            lastName: m.lastName,
            role: 'electoral_commission'
          }));
          updated = true;
        }
      }

      if (updated) {
        await org.save();
        migratedCount++;
      }
    }

    if (migratedCount > 0) {
      console.log(`Auto-migration: ${migratedCount} organizations updated`);
    }
  } catch (error) {
    console.error('Auto-migration error:', error);
  }
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB Atlas');
    // Run auto-migration on startup
    await autoMigrateOrganizations();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ============ TIMEOUTS DE CONEXIÓN ============
// Timeout para requests que tardan demasiado (30s)
server.setTimeout(30000);

// Keep-alive timeout (65s - mayor que el timeout de AWS/proxies que suele ser 60s)
server.keepAliveTimeout = 65000;

// Headers timeout (debe ser mayor que keepAliveTimeout)
server.headersTimeout = 66000;

export default app;
