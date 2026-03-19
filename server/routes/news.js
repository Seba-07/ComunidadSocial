import express from 'express';
import multer from 'multer';
import News from '../models/News.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate, createNewsSchema, updateNewsSchema } from '../middleware/validation.js';
import * as storageService from '../services/storageService.js';

const router = express.Router();

// Multer en memoria — las imágenes van a S3
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

/**
 * GET /api/news
 * Obtener todas las noticias (público para publicadas)
 */
router.get('/', async (req, res) => {
  try {
    const { category, search, includeUnpublished } = req.query;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filter = {};

    // Solo mostrar publicadas por defecto; solo admin autenticado puede ver borradores
    const showUnpublished = includeUnpublished === 'true';
    if (!showUnpublished) {
      filter.isPublished = true;
    }

    if (category && category !== 'TODAS') {
      filter.category = category;
    }

    if (search && typeof search === 'string' && search.length <= 100) {
      filter.$text = { $search: search.slice(0, 100) };
    }

    const skip = (page - 1) * limit;

    const [news, total] = await Promise.all([
      News.find(filter)
        .populate('author', 'firstName lastName email')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      News.countDocuments(filter)
    ]);

    // Resolve S3 URLs for featured images
    const resolved = await Promise.all(news.map(async (article) => {
      const obj = article.toObject ? article.toObject() : { ...article };
      if (obj.featuredImageS3Key) {
        obj.featuredImage = await storageService.getDocumentUrl({ s3Key: obj.featuredImageS3Key }) || obj.featuredImage;
      }
      return obj;
    }));

    res.json({
      news: resolved,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener noticias:', error);
    res.status(500).json({ error: 'Error al obtener noticias' });
  }
});

/**
 * GET /api/news/categories
 * Obtener categorías disponibles
 */
router.get('/categories', (req, res) => {
  res.json(News.getCategoryLabels());
});

/**
 * GET /api/news/:idOrSlug
 * Obtener una noticia por ID o slug
 */
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let article;

    // Intentar buscar por ID primero
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      article = await News.findById(idOrSlug).populate('author', 'firstName lastName email');
    }

    // Si no se encontró por ID, buscar por slug
    if (!article) {
      article = await News.findOne({ slug: idOrSlug }).populate('author', 'firstName lastName email');
    }

    if (!article) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    // Resolve S3 URL
    const obj = article.toObject();
    if (obj.featuredImageS3Key) {
      obj.featuredImage = await storageService.getDocumentUrl({ s3Key: obj.featuredImageS3Key }) || obj.featuredImage;
    }

    // Incrementar vistas de forma atómica (no bloquea la respuesta)
    News.incrementView(article._id).catch(() => {});

    res.json(obj);
  } catch (error) {
    console.error('Error al obtener noticia:', error);
    res.status(500).json({ error: 'Error al obtener noticia' });
  }
});

/**
 * POST /api/news
 * Crear una nueva noticia (solo MUNICIPALIDAD)
 */
router.post('/', authenticate, requireRole('MUNICIPALIDAD'), validate(createNewsSchema), async (req, res) => {
  try {
    const { title, summary, contentHTML, category, tags, isPublished, featuredImage } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'El título es requerido' });
    }

    const article = new News({
      title,
      summary: summary || '',
      contentHTML: contentHTML || '',
      category: category || 'NOTICIAS',
      tags: tags || [],
      featuredImage: featuredImage || '',
      author: req.user._id,
      isPublished: isPublished || false,
      publishedAt: isPublished ? new Date() : null
    });

    await article.save();

    res.status(201).json(article);
  } catch (error) {
    console.error('Error al crear noticia:', error);
    res.status(500).json({ error: 'Error al crear noticia' });
  }
});

/**
 * POST /api/news/upload-image
 * Subir imagen destacada a S3 (solo MUNICIPALIDAD)
 */
router.post('/upload-image', authenticate, requireRole('MUNICIPALIDAD'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    // Upload to S3
    const result = await storageService.storeFile(req.file.buffer, req.file.mimetype, {
      organizationId: 'news',
      type: 'featured-image',
      fileName: req.file.originalname
    });

    // Resolve URL for response
    const imageUrl = result.s3Key
      ? await storageService.getDocumentUrl({ s3Key: result.s3Key })
      : result.data;

    res.json({
      url: imageUrl,
      s3Key: result.s3Key || null
    });
  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

/**
 * PUT /api/news/:id
 * Actualizar una noticia (solo MUNICIPALIDAD)
 */
router.put('/:id', authenticate, requireRole('MUNICIPALIDAD'), validate(updateNewsSchema), async (req, res) => {
  try {
    const { title, summary, contentHTML, category, tags, isPublished, featuredImage, featuredImageS3Key } = req.body;

    const article = await News.findById(req.params.id);

    if (!article) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    if (title !== undefined) article.title = title;
    if (summary !== undefined) article.summary = summary;
    if (contentHTML !== undefined) article.contentHTML = contentHTML;
    if (category !== undefined) article.category = category;
    if (tags !== undefined) article.tags = tags;
    if (featuredImage !== undefined) article.featuredImage = featuredImage;
    if (featuredImageS3Key !== undefined) article.featuredImageS3Key = featuredImageS3Key;

    // Manejar publicación
    if (isPublished !== undefined) {
      if (isPublished && !article.isPublished) {
        article.isPublished = true;
        article.publishedAt = new Date();
      } else if (!isPublished) {
        article.isPublished = false;
      }
    }

    await article.save();

    res.json(article);
  } catch (error) {
    console.error('Error al actualizar noticia:', error);
    res.status(500).json({ error: 'Error al actualizar noticia' });
  }
});

/**
 * POST /api/news/:id/publish
 */
router.post('/:id/publish', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const article = await News.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Noticia no encontrada' });
    await article.publish();
    res.json({ message: 'Noticia publicada correctamente', article });
  } catch (error) {
    console.error('Error al publicar noticia:', error);
    res.status(500).json({ error: 'Error al publicar noticia' });
  }
});

/**
 * POST /api/news/:id/unpublish
 */
router.post('/:id/unpublish', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const article = await News.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Noticia no encontrada' });
    await article.unpublish();
    res.json({ message: 'Noticia despublicada correctamente', article });
  } catch (error) {
    console.error('Error al despublicar noticia:', error);
    res.status(500).json({ error: 'Error al despublicar noticia' });
  }
});

/**
 * DELETE /api/news/:id
 */
router.delete('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const article = await News.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Noticia no encontrada' });

    // Delete S3 image if exists
    if (article.featuredImageS3Key) {
      await storageService.deleteDocument({ s3Key: article.featuredImageS3Key });
    }

    await News.findByIdAndDelete(req.params.id);
    res.json({ message: 'Noticia eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar noticia:', error);
    res.status(500).json({ error: 'Error al eliminar noticia' });
  }
});

export default router;
