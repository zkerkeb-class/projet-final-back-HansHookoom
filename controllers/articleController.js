import Article from '../models/Article.js';

// Récupérer tous les articles avec pagination
const getArticles = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const articles = await Article.find()
      .populate('author', 'email username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Article.countDocuments();

    res.json({ 
      articles, 
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: articles.length,
        totalArticles: total
      }
    });
  } catch (error) {
    console.error('Erreur articles:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des articles' });
  }
};

// Récupérer un article par slug
const getArticleBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const article = await Article.findOne({ slug }).populate('author', 'email username');
    
    if (!article) {
      return res.status(404).json({ message: 'Article non trouvé' });
    }

    res.json({ article });
  } catch (error) {
    console.error('Erreur récupération article par slug:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'article' });
  }
};

// Récupérer un article par ID ou slug
const getArticle = async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Chercher par ID MongoDB ou par slug
    const query = identifier.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: identifier } 
      : { slug: identifier };
    
    const article = await Article.findOne(query).populate('author', 'email username');
    
    if (!article) {
      return res.status(404).json({ message: 'Article non trouvé' });
    }

    res.json({ article });
  } catch (error) {
    console.error('Erreur récupération article:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'article' });
  }
};

// Créer un article (Admin seulement)
const createArticle = async (req, res) => {
  try {
    const { title, slug, excerpt, content, image, secondaryImage, readingTime } = req.body;

    const article = new Article({
      title,
      slug,
      excerpt,
      content,
      image,
      secondaryImage,
      readingTime,
      author: req.user.userId
    });

    await article.save();
    await article.populate('author', 'email username');

    res.status(201).json({ 
      message: 'Article créé avec succès',
      article 
    });
  } catch (error) {
    console.error('Erreur création article:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Ce slug existe déjà' });
    }
    res.status(500).json({ message: 'Erreur lors de la création de l\'article' });
  }
};

// Modifier un article (Admin seulement)
const updateArticle = async (req, res) => {
  try {
    const { title, slug, excerpt, content, image, secondaryImage, readingTime } = req.body;
    
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { title, slug, excerpt, content, image, secondaryImage, readingTime, updatedAt: Date.now() },
      { new: true }
    ).populate('author', 'email username');

    if (!article) {
      return res.status(404).json({ message: 'Article non trouvé' });
    }

    res.json({ 
      message: 'Article modifié avec succès',
      article 
    });
  } catch (error) {
    console.error('Erreur modification article:', error);
    res.status(500).json({ message: 'Erreur lors de la modification de l\'article' });
  }
};

// Supprimer un article (Admin seulement)
const deleteArticle = async (req, res) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Article non trouvé' });
    }

    res.json({ message: 'Article supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression article:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'article' });
  }
};

export {
  getArticles,
  getArticleBySlug,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle
}; 