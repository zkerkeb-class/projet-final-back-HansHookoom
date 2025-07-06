import multer from 'multer';
import mongoose from 'mongoose';
import { getGridFS } from '../config/database.js';

// Configuration de Multer pour l'upload en mémoire
const uploadConfig = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers images sont autorisés'), false);
    }
  }
});

// Upload d'image (Admin seulement)
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    const { gfsBucket } = getGridFS();
    if (!gfsBucket) {
      return res.status(500).json({ message: 'Service de stockage non initialisé' });
    }

    // Créer un stream d'upload vers GridFS
    const uploadStream = gfsBucket.openUploadStream(req.file.originalname, {
      metadata: {
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        uploadedBy: req.user.userId,
        uploadedAt: new Date()
      }
    });

    // Gérer la fin de l'upload
    uploadStream.on('finish', () => {
      res.status(201).json({
        message: 'Image uploadée avec succès',
        fileId: uploadStream.id,
        filename: req.file.originalname,
        imageUrl: `/api/images/${uploadStream.id}`
      });
    });

    uploadStream.on('error', (error) => {
      console.error('Erreur upload GridFS:', error);
      res.status(500).json({ message: 'Erreur lors de l\'upload de l\'image' });
    });

    // Écrire le fichier dans le stream
    uploadStream.end(req.file.buffer);

  } catch (error) {
    console.error('Erreur upload image:', error);
    res.status(500).json({ message: 'Erreur lors de l\'upload de l\'image' });
  }
};

// Récupérer une image par ID
const getImage = async (req, res) => {
  try {
    const { gfsBucket } = getGridFS();
    if (!gfsBucket) {
      return res.status(500).json({ message: 'Service de stockage non initialisé' });
    }

    const fileId = new mongoose.Types.ObjectId(req.params.id);
    
    // Vérifier si le fichier existe
    const files = await gfsBucket.find({ _id: fileId }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Image non trouvée' });
    }

    const file = files[0];
    
    // Définir le type de contenu
    res.set('Content-Type', file.metadata.mimetype);
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    
    // Créer un stream de lecture et l'envoyer en réponse
    const downloadStream = gfsBucket.openDownloadStream(fileId);
    downloadStream.pipe(res);
    
  } catch (error) {
    console.error('Erreur récupération image:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'image' });
  }
};

// Lister toutes les images (Admin seulement)
const getImages = async (req, res) => {
  try {
    const { gfsBucket } = getGridFS();
    if (!gfsBucket) {
      return res.status(500).json({ message: 'Service de stockage non initialisé' });
    }

    const files = await gfsBucket.find({}).sort({ uploadDate: -1 }).toArray();
    
    const images = files.map(file => ({
      id: file._id,
      filename: file.filename,
      originalName: file.metadata?.originalName || file.filename,
      mimetype: file.metadata?.mimetype,
      size: file.length,
      uploadDate: file.uploadDate,
      imageUrl: `/api/images/${file._id}`
    }));

    res.json({ images });
  } catch (error) {
    console.error('Erreur liste images:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des images' });
  }
};

// Supprimer une image (Admin seulement)
const deleteImage = async (req, res) => {
  try {
    const { gfsBucket } = getGridFS();
    if (!gfsBucket) {
      return res.status(500).json({ message: 'Service de stockage non initialisé' });
    }

    const fileId = new mongoose.Types.ObjectId(req.params.id);
    
    await gfsBucket.delete(fileId);
    res.json({ message: 'Image supprimée avec succès' });
    
  } catch (error) {
    console.error('Erreur suppression image:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'image' });
  }
};

// Middleware pour gérer les erreurs Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'L\'image ne peut pas dépasser 2MB' 
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        message: 'Format de fichier non autorisé' 
      });
    }
    return res.status(400).json({ 
      message: `Erreur d'upload: ${err.message}` 
    });
  }
  
  // Autres erreurs (comme le fileFilter)
  if (err.message === 'Seuls les fichiers images sont autorisés') {
    return res.status(400).json({ message: err.message });
  }
  
  next(err);
};

const upload = uploadConfig.single('image');

export {
  upload,
  uploadImage,
  getImage,
  getImages,
  deleteImage,
  handleMulterError
}; 