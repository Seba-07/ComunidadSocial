import express from 'express';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import News from '../models/News.js';
import LibraryDocument from '../models/LibraryDocument.js';
import { authenticate } from '../middleware/auth.js';
import { maskEmail } from '../middleware/dataMasking.js';

const router = express.Router();

/**
 * GET /api/search?q=texto&type=organizations|users|news|documents
 * Búsqueda global en todos los recursos del sistema.
 * Si no se especifica type, busca en todos los recursos.
 * Si se especifica type, busca solo en ese recurso.
 * Límite: 10 resultados por tipo de recurso.
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { q, type } = req.query;

    // Validar que el parámetro de búsqueda exista y tenga al menos 2 caracteres (max 100)
    if (!q || typeof q !== 'string' || q.trim().length < 2 || q.trim().length > 100) {
      return res.status(400).json({
        error: 'El parámetro de búsqueda "q" es requerido (2-100 caracteres)'
      });
    }

    // Validar el tipo si se proporciona
    const validTypes = ['organizations', 'users', 'news', 'documents'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        error: `Tipo no válido. Valores permitidos: ${validTypes.join(', ')}`
      });
    }

    const searchTerm = q.trim();
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const results = {
      organizations: [],
      users: [],
      news: [],
      documents: []
    };

    // Determinar qué recursos buscar
    const searchAll = !type;

    // Buscar en Organizaciones
    if (searchAll || type === 'organizations') {
      // Non-admin users: search only by org name (no member name search to prevent data leaks)
      const orgQuery = req.user.role === 'MUNICIPALIDAD'
        ? { $or: [{ organizationName: regex }, { 'members.firstName': regex }, { 'members.lastName': regex }] }
        : { organizationName: regex };

      results.organizations = await Organization.find(orgQuery)
        .select('organizationName organizationType status createdAt')
        .limit(10)
        .lean();
    }

    // Buscar en Usuarios
    if (searchAll || type === 'users') {
      // Non-admin users: search only by name, not by email
      const userQuery = req.user.role === 'MUNICIPALIDAD'
        ? { $or: [{ firstName: regex }, { lastName: regex }, { email: regex }] }
        : { $or: [{ firstName: regex }, { lastName: regex }] };

      results.users = await User.find(userQuery)
        .select(req.user.role === 'MUNICIPALIDAD' ? 'firstName lastName email role' : 'firstName lastName role')
        .limit(10)
        .lean();
      // Mask emails for non-admin users
      if (req.user.role !== 'MUNICIPALIDAD') {
        results.users.forEach(u => { u.email = undefined; });
      }
    }

    // Buscar en Noticias
    if (searchAll || type === 'news') {
      results.news = await News.find({
        $or: [
          { title: regex },
          { summary: regex }
        ]
      })
        .select('title category publishedAt')
        .limit(10)
        .lean();
    }

    // Buscar en Documentos de Biblioteca
    if (searchAll || type === 'documents') {
      results.documents = await LibraryDocument.find({
        $or: [
          { name: regex },
          { description: regex }
        ]
      })
        .select('name category fileName')
        .limit(10)
        .lean();
    }

    // Calcular total de resultados
    const totalResults =
      results.organizations.length +
      results.users.length +
      results.news.length +
      results.documents.length;

    res.json({
      ...results,
      totalResults
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Error al realizar la búsqueda' });
  }
});

export default router;
