import app from './app.js';
import User from './models/User.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    app.listen(PORT, async () => {
      console.log(`🚀 Serveur Segarow démarré sur le port ${PORT}`);
      console.log(`📡 API disponible sur http://localhost:${PORT}`);
      console.log(`🧪 Test API: http://localhost:${PORT}/api/test`);
      
      // Vérifier s'il y a des admins
      try {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount === 0) {
          console.log('\n⚠️  Aucun administrateur trouvé !');
          console.log('🔧 Pour créer le premier admin, utilisez cette requête POST :');
          console.log(`📋 URL: http://localhost:${PORT}/api/admin/create-first-admin`);
          console.log('📝 Body JSON:');
          console.log(JSON.stringify({
            email: 'admin@segarow.com',
            password: 'admin123',
            username: 'AdminSegarow',
            secretKey: 'segarow-first-admin-2024'
          }, null, 2));
          console.log('\n✨ Ou utilisez cette commande curl :');
          console.log(`curl -X POST http://localhost:${PORT}/api/admin/create-first-admin \\`);
          console.log(`  -H "Content-Type: application/json" \\`);
          console.log(`  -d '${JSON.stringify({
            email: 'admin@segarow.com',
            password: 'admin123',
            username: 'AdminSegarow',
            secretKey: 'segarow-first-admin-2024'
          })}'`);
          console.log('\n');
        } else {
          console.log(`👥 ${adminCount} administrateur(s) configuré(s)`);
        }
      } catch (error) {
        console.error('Erreur vérification admins:', error);
      }
    });
  } catch (error) {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
  }
};

// Gestion des signaux pour arrêt propre
process.on('SIGTERM', () => {
  console.log('🛑 Signal SIGTERM reçu, arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Signal SIGINT reçu, arrêt du serveur...');
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (err) => {
  console.error('❌ Promesse rejetée non gérée:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Exception non capturée:', err);
  process.exit(1);
});

startServer(); 