import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware pour vérifier le token
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    console.log('🔒 AUTH FAILED: Token manquant');
    return res.status(401).json({ message: 'Accès refusé, token manquant' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log('✅ AUTH SUCCESS:', decoded.email || decoded.userId);
    next();
  } catch (error) {
    console.log('🔒 AUTH FAILED: Token invalide', error.message);
    res.status(401).json({ message: 'Token invalide' });
  }
};

// Middleware d'authentification optionnel
const optionalAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

// Middleware pour vérifier si l'utilisateur est admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès refusé - Droits administrateur requis' });
  }
  next();
};

export {
  auth,
  optionalAuth,
  requireAdmin
}; 