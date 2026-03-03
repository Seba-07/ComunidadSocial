import express from 'express';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import News from '../models/News.js';
import LibraryDocument from '../models/LibraryDocument.js';
import { authenticate } from '../middleware/auth.js';

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

    // Validar que el parámetro de búsqueda exista y tenga al menos 2 caracteres
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({
        error: 'El parámetro de búsqueda "q" es requerido y debe tener al menos 2 caracteres'
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
      results.organizations = await Organization.find({
        $or: [
          { organizationName: regex },
          { 'members.firstName': regex },
          { 'members.lastName': regex }
        ]
      })
        .select('organizationName organizationType status createdAt')
        .limit(10)
        .lean();
    }

    // Buscar en Usuarios
    if (searchAll || type === 'users') {
      results.users = await User.find({
        $or: [
          { firstName: regex },
          { lastName: regex },
          { email: regex }
        ]
      })
        .select('firstName lastName email role')
        .limit(10)
        .lean();
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
