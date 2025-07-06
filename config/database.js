import mongoose from 'mongoose';
import GridFS from 'gridfs-stream';
import { GridFSBucket } from 'mongodb';

// Variables globales pour GridFS
let gfs, gfsBucket;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB connecté: ${conn.connection.host}`);
    
    // Initialiser GridFS après connexion
    gfsBucket = new GridFSBucket(conn.connection.db, {
      bucketName: 'uploads'
    });
    
    gfs = GridFS(conn.connection.db, mongoose.mongo);
    gfs.collection('uploads');
    
    console.log('✅ GridFS initialisé pour le stockage d\'images');
    
    return { gfs, gfsBucket };
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error.message);
    process.exit(1);
  }
};

const getGridFS = () => ({ gfs, gfsBucket });

export {
  connectDB,
  getGridFS
}; 