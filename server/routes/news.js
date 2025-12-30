import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import News from '../models/News.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Crear directorio de uploads para imágenes si no existe
const uploadDir = './uploads/news';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar multer para imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF, WebP)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB para imágenes
  }
});

/**
 * GET /api/news
 * Obtener todas las noticias (público para publicadas)
 */
router.get('/', async (req, res) => {
  try {
    const { category, search, includeUnpublished, limit = 20, page = 1 } = req.query;
    const filter = {};

    // Solo mostrar publicadas a usuarios no autenticados o no admin
    if (!includeUnpublished || includeUnpublished !== 'true') {
      filter.isPublished = true;
    }

    if (category && category !== 'TODAS') {
      filter.category = category;
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [news, total] = await Promise.all([
      News.find(filter)
        .populate('author', 'firstName lastName email')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      News.countDocuments(filter)
    ]);

    res.json({
      news,
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

    // Incrementar vistas
    await article.incrementView();

    res.json(article);
  } catch (error) {
    console.error('Error al obtener noticia:', error);
    res.status(500).json({ error: 'Error al obtener noticia' });
  }
});

/**
 * POST /api/news
 * Crear una nueva noticia (solo MUNICIPALIDAD)
 */
router.post('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
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
 * Subir imagen para el editor (solo MUNICIPALIDAD)
 */
router.post('/upload-image', authenticate, requireRole('MUNICIPALIDAD'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    // Construir URL de la imagen
    const imageUrl = `/uploads/news/${req.file.filename}`;

    res.json({
      url: imageUrl,
      filename: req.file.filename
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
router.put('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { title, summary, contentHTML, category, tags, isPublished, featuredImage } = req.body;

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

    // Manejar publicación
    if (isPublished !== undefined) {
      if (isPublished && !article.isPublished) {
        // Publicar por primera vez
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
 * Publicar una noticia (solo MUNICIPALIDAD)
 */
router.post('/:id/publish', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const article = await News.findById(req.params.id);

    if (!article) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    await article.publish();

    res.json({ message: 'Noticia publicada correctamente', article });
  } catch (error) {
    console.error('Error al publicar noticia:', error);
    res.status(500).json({ error: 'Error al publicar noticia' });
  }
});

/**
 * POST /api/news/:id/unpublish
 * Despublicar una noticia (solo MUNICIPALIDAD)
 */
router.post('/:id/unpublish', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const article = await News.findById(req.params.id);

    if (!article) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    await article.unpublish();

    res.json({ message: 'Noticia despublicada correctamente', article });
  } catch (error) {
    console.error('Error al despublicar noticia:', error);
    res.status(500).json({ error: 'Error al despublicar noticia' });
  }
});

/**
 * DELETE /api/news/:id
 * Eliminar una noticia (solo MUNICIPALIDAD)
 */
router.delete('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const article = await News.findById(req.params.id);

    if (!article) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    // Eliminar imagen destacada si existe
    if (article.featuredImage && article.featuredImage.startsWith('/uploads/news/')) {
      const imagePath = '.' + article.featuredImage;
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (e) {
        console.error('Error al eliminar imagen:', e);
      }
    }

    await News.findByIdAndDelete(req.params.id);

    res.json({ message: 'Noticia eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar noticia:', error);
    res.status(500).json({ error: 'Error al eliminar noticia' });
  }
});

export default router;
