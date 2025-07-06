import Review from '../models/Review.js';

// Récupérer toutes les reviews avec pagination
const getReviews = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const reviews = await Review.find()
      .populate('author', 'email username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments();

    res.json({ 
      reviews, 
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: reviews.length,
        totalReviews: total
      }
    });
  } catch (error) {
    console.error('Erreur reviews:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des reviews' });
  }
};

// Récupérer une review par ID ou slug
const getReview = async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Chercher par ID MongoDB ou par slug
    const query = identifier.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: identifier } 
      : { slug: identifier };
    
    const review = await Review.findOne(query).populate('author', 'email username');
    
    if (!review) {
      return res.status(404).json({ message: 'Review non trouvée' });
    }

    res.json({ review });
  } catch (error) {
    console.error('Erreur récupération review:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la review' });
  }
};

// Créer une review (Admin seulement)
const createReview = async (req, res) => {
  try {
    const { title, slug, excerpt, content, image, secondaryImage, readingTime, rating, gameTitle, platform, genre } = req.body;

    const review = new Review({
      title,
      slug,
      excerpt,
      content,
      image,
      secondaryImage,
      readingTime,
      rating,
      gameTitle,
      platform,
      genre,
      author: req.user.userId
    });

    await review.save();
    await review.populate('author', 'email username');

    res.status(201).json({ 
      message: 'Review créée avec succès',
      review 
    });
  } catch (error) {
    console.error('Erreur création review:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Ce slug existe déjà' });
    }
    res.status(500).json({ message: 'Erreur lors de la création de la review' });
  }
};

// Modifier une review (Admin seulement)
const updateReview = async (req, res) => {
  try {
    const { title, slug, excerpt, content, image, secondaryImage, readingTime, rating, gameTitle, platform, genre } = req.body;
    
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { title, slug, excerpt, content, image, secondaryImage, readingTime, rating, gameTitle, platform, genre, updatedAt: Date.now() },
      { new: true }
    ).populate('author', 'email username');

    if (!review) {
      return res.status(404).json({ message: 'Review non trouvée' });
    }

    res.json({ 
      message: 'Review modifiée avec succès',
      review 
    });
  } catch (error) {
    console.error('Erreur modification review:', error);
    res.status(500).json({ message: 'Erreur lors de la modification de la review' });
  }
};

// Supprimer une review (Admin seulement)
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    
    if (!review) {
      return res.status(404).json({ message: 'Review non trouvée' });
    }

    res.json({ message: 'Review supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression review:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la review' });
  }
};

export {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview
}; 