import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import multer from 'multer';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8082;

// Initialize Ollama (for auto-translation) via dynamic import so it's optional
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
/** @type {any | null} */
let ollama = null;

(async () => {
  try {
    // Dynamically import ollama so the server still runs if the package is missing
    const { Ollama } = await import('ollama');
    ollama = new Ollama({ host: ollamaBaseUrl });
    console.log(`✅ Ollama initialized with host: ${ollamaBaseUrl}`);
  } catch (error) {
    console.warn('⚠️ Ollama not initialized. Auto-translation will be disabled.');
    console.warn('   If you want auto-translation, install the ollama package and ensure the Ollama server is running.');
    ollama = null;
  }
})();

// Allowed CORS origins (local dev + ngrok tunnel)
const allowedOrigins = [
  'http://localhost:5173',
  'https://uncorroborated-divergent-kyleigh.ngrok-free.dev',
];

// Enable CORS
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        // Allow non-browser clients / same-origin
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn(`CORS: blocked origin ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  })
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Helper function to read portfolioData.json
function readPortfolioData() {
  const portfolioDataPath = path.join(__dirname, '..', 'src', 'data', 'portfolioData.json');
  const content = fs.readFileSync(portfolioDataPath, 'utf-8');
  return JSON.parse(content);
}

// Helper function to write portfolioData.json
function writePortfolioData(data) {
  const portfolioDataPath = path.join(__dirname, '..', 'src', 'data', 'portfolioData.json');
  fs.writeFileSync(portfolioDataPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Multer storage for work gallery uploads (temporary upload directory)
const workUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'works');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `work-upload-${timestamp}${ext}`);
  },
});

const workUpload = multer({
  storage: workUploadStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Find a work by numeric ID across all categories
function findWorkById(portfolioData, workId) {
  if (!portfolioData.works) return null;
  const sections = ['theaterDirector', 'actress', 'movieDirector'];
  for (const section of sections) {
    const arr = portfolioData.works[section];
    if (Array.isArray(arr)) {
      const index = arr.findIndex((w) => w.id === workId);
      if (index !== -1) {
        return { section, index, work: arr[index] };
      }
    }
  }
  return null;
}

// Process a work image: resize/compress with ImageMagick, no watermark, target < 200KB
function processWorkImage(sourcePath, destPath) {
  try {
    let quality = 85;
    const maxSize = 200 * 1024; // 200 KB

    for (let attempt = 0; attempt < 5; attempt++) {
      // Resize to max 1920px, strip metadata, adjust quality
      execSync(
        `magick "${sourcePath}" -auto-orient -resize "1920x1920>" -strip -quality ${quality} "${destPath}"`,
        { stdio: 'ignore' }
      );

      const { size } = fs.statSync(destPath);
      if (size <= maxSize || quality <= 40) {
        break;
      }

      // Reduce quality and try again
      quality -= 10;
    }

    return { success: true };
  } catch (error) {
    console.error('Error processing work image:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to set nested property using dot notation path
// Supports array indices like "works.theaterDirector[0].title.en"
function setNestedProperty(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
    
    if (arrayMatch) {
      const arrayName = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      
      if (!(arrayName in current)) {
        current[arrayName] = [];
      }
      if (!Array.isArray(current[arrayName])) {
        throw new Error(`Expected array at ${arrayName}, got ${typeof current[arrayName]}`);
      }
      if (current[arrayName][index] === undefined) {
        current[arrayName][index] = {};
      }
      current = current[arrayName][index];
    } else {
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
  }
  
  // Set the final value
  const finalKey = keys[keys.length - 1];
  const finalArrayMatch = finalKey.match(/^(\w+)\[(\d+)\]$/);
  
  if (finalArrayMatch) {
    const arrayName = finalArrayMatch[1];
    const index = parseInt(finalArrayMatch[2], 10);
    if (!(arrayName in current)) {
      current[arrayName] = [];
    }
    current[arrayName][index] = value;
  } else {
    current[finalKey] = value;
  }
}

// Helper function to get nested property using dot notation path
function getNestedProperty(obj, path) {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
    
    if (arrayMatch) {
      const arrayName = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      if (!(arrayName in current) || !Array.isArray(current[arrayName])) {
        return undefined;
      }
      current = current[arrayName][index];
    } else {
      if (!(key in current)) {
        return undefined;
      }
      current = current[key];
    }
    
    if (current === undefined || current === null) {
      return undefined;
    }
  }
  return current;
}

// Helper function to translate text using Ollama (copied from original server.js)
async function translateText(text, sourceLanguage, targetLanguage) {
  if (!ollama) {
    throw new Error('Ollama is not configured. Make sure Ollama is running.');
  }
  
  const sourceLang = sourceLanguage === 'es' ? 'Spanish' : 'English';
  const targetLang = targetLanguage === 'es' ? 'Spanish' : 'English';
  
  const prompt = `Translate the following text from ${sourceLang} to ${targetLang}. Only return the translation, no explanations or additional text, and respect the paragrah source:\n\n${text}`;
  
  try {
    console.log(`🔄 Translating from ${sourceLang} to ${targetLang}...`);
    const response = await ollama.generate({
      model: process.env.OLLAMA_MODEL || 'mistral', // Default model, can be overridden
      prompt: prompt,
      stream: false, // Don't stream, get full response
    });
    
    // Extract the translation from the response
    const translation = (response.response || '').trim();
    
    if (!translation) {
      throw new Error('Empty translation response from Ollama');
    }
    
    console.log(`✅ Translation complete: ${translation.substring(0, 100)}...`);
    return translation;
  } catch (error) {
    console.error('Ollama translation error:', error);
    if (error.cause && error.cause.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to Ollama. Make sure Ollama is running at ' + ollamaBaseUrl);
    }
    throw error;
  }
}

// Upload work gallery image (used by Works detail page photo gallery)
// Each image is uploaded individually; it is resized/compressed with ImageMagick (no watermark)
// and appended to the end of the corresponding work's images array in portfolioData.json
app.post('/api/works/:workId/images', workUpload.single('image'), async (req, res) => {
  try {
    console.log('=== WORK IMAGE UPLOAD REQUEST ===');
    console.log('File:', req.file ? req.file.originalname : 'No file');
    console.log('Params:', req.params);

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workId = Number(req.params.workId);
    if (!workId || Number.isNaN(workId)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid workId' });
    }

    const portfolioData = readPortfolioData();
    const found = findWorkById(portfolioData, workId);

    if (!found) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: `Work with id ${workId} not found` });
    }

    const { section, index, work } = found;
    console.log(`Uploading image for work ${workId} in section ${section} at index ${index}`);

    // Derive directory name from existing thumbnail or first image
    let baseFolder = 'misc';
    const basePath =
      (work.thumbnail && typeof work.thumbnail === 'string' && work.thumbnail) ||
      (work.images && work.images.length > 0 && work.images[0].url);

    if (basePath && typeof basePath === 'string' && basePath.startsWith('/works/')) {
      const segments = basePath.split('/');
      if (segments.length >= 3 && segments[2]) {
        baseFolder = segments[2];
      }
    }

    const worksDir = path.join(__dirname, '..', 'public', 'works', baseFolder);
    if (!fs.existsSync(worksDir)) {
      fs.mkdirSync(worksDir, { recursive: true });
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const filename = `work-${Date.now()}${ext}`;
    const destPath = path.join(worksDir, filename);

    // Process image with ImageMagick (resize + compress, no watermark)
    const result = processWorkImage(req.file.path, destPath);

    // Remove temp upload
    fs.unlinkSync(req.file.path);

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to process image' });
    }

    const urlPath = `/works/${baseFolder}/${filename}`;

    // Append new image to the end of the work's images array
    if (!Array.isArray(work.images)) {
      work.images = [];
    }

    work.images.push({
      url: urlPath,
      caption: {
        en: 'Scene from the play',
        es: 'Escena de la obra',
      },
    });

    portfolioData.works[section][index] = work;
    writePortfolioData(portfolioData);

    console.log(`✅ Added new image to work ${workId}: ${urlPath}`);

    res.json({
      success: true,
      image: {
        url: urlPath,
        index: work.images.length - 1,
      },
    });
  } catch (error) {
    console.error('Work image upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete a work gallery image (remove from JSON and, if local, from disk)
app.delete('/api/works/:workId/images', async (req, res) => {
  try {
    const workId = Number(req.params.workId);
    const { url } = req.body || {};

    if (!workId || Number.isNaN(workId)) {
      return res.status(400).json({ error: 'Invalid workId' });
    }
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const portfolioData = readPortfolioData();
    const found = findWorkById(portfolioData, workId);

    if (!found) {
      return res.status(404).json({ error: `Work with id ${workId} not found` });
    }

    const { section, index, work } = found;
    if (!Array.isArray(work.images)) {
      return res.status(404).json({ error: 'No images found for this work' });
    }

    const imageIndex = work.images.findIndex((img) => img && img.url === url);
    if (imageIndex === -1) {
      return res.status(404).json({ error: 'Image not found in work gallery' });
    }

    // Remove from images array
    const [removed] = work.images.splice(imageIndex, 1);
    portfolioData.works[section][index] = work;
    writePortfolioData(portfolioData);

    // If this is a local file under /works/, try to delete it from disk
    if (typeof removed.url === 'string' && removed.url.startsWith('/works/')) {
      const filePath = path.join(__dirname, '..', 'public', removed.url);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fsErr) {
        console.warn('Failed to delete image file from disk:', fsErr);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete work image error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Favorites API: manage hero slideshow favorites (list of image URLs)
app.get('/api/favorites', (req, res) => {
  try {
    const data = readPortfolioData();
    const favorites = (data.home && Array.isArray(data.home.favorites))
      ? data.home.favorites
      : [];
    res.json({ favorites });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/favorites', (req, res) => {
  try {
    const { url, favorite } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required' });
    }

    const data = readPortfolioData();
    if (!data.home) data.home = {};
    if (!Array.isArray(data.home.favorites)) data.home.favorites = [];

    const current = new Set(data.home.favorites);

    // favorite: true → add, false → remove; if undefined, toggle
    let shouldFavorite = favorite;
    if (typeof shouldFavorite !== 'boolean') {
      shouldFavorite = !current.has(url);
    }

    if (shouldFavorite) {
      current.add(url);
    } else {
      current.delete(url);
    }

    data.home.favorites = Array.from(current);
    writePortfolioData(data);

    res.json({ favorites: data.home.favorites });
  } catch (error) {
    console.error('Update favorites error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update portfolio data endpoint
app.put('/api/portfolio', async (req, res) => {
  try {
    const { path: dataPath, value, language } = req.body;
    
    console.log('=== UPDATE PORTFOLIO DATA REQUEST ===');
    console.log(`Path: ${dataPath}`);
    console.log(`Value: ${value !== undefined ? (value.substring(0, 100) + (value.length > 100 ? '...' : '')) : 'undefined'}`);
    console.log(`Language: ${language || 'N/A'}`);
    
    if (!dataPath || value === undefined) {
      return res.status(400).json({ error: 'path and value are required' });
    }
    
    // Read current portfolio data
    const portfolioData = readPortfolioData();
    
    // Base path without language suffix (e.g., works.theaterDirector[0].description)
    let basePath = dataPath;
    if (dataPath.endsWith('.en') || dataPath.endsWith('.es')) {
      basePath = dataPath.replace(/\.(en|es)$/, '');
    }

    // Determine primary language (the one being directly edited)
    const primaryLang = language === 'es' || language === 'en' ? language : undefined;

    // Primary path to update
    let primaryPath = dataPath;
    if (primaryLang) {
      if (dataPath.endsWith('.en') || dataPath.endsWith('.es')) {
        primaryPath = dataPath.replace(/\.(en|es)$/, `.${primaryLang}`);
      } else {
        primaryPath = `${dataPath}.${primaryLang}`;
      }
    }

    // Update primary language value
    setNestedProperty(portfolioData, primaryPath, value);

    // Auto-translate to the other language if possible
    if (primaryLang) {
      const otherLang = primaryLang === 'en' ? 'es' : 'en';
      let otherValue = req.body[otherLang]; // Optional explicit value
      
      // Titles should not be machine-translated; copy the value as-is to both languages
      const isTitleField = basePath.endsWith('.title');

      if (!otherValue) {
        if (isTitleField) {
          otherValue = value; // Use the same text for both languages
        } else if (ollama) {
          try {
            otherValue = await translateText(value, primaryLang, otherLang);
          } catch (error) {
            console.warn(
              '⚠️ Auto-translation failed, keeping only primary language:',
              (error && error.message) || error
            );
          }
        }
      }

      if (otherValue) {
        const otherPath = `${basePath}.${otherLang}`;
        setNestedProperty(portfolioData, otherPath, otherValue);
      }
    }
    
    // Write back to file
    writePortfolioData(portfolioData);
    
    console.log(`✅ Successfully updated portfolio data at path: ${primaryPath}`);
    res.json({ success: true, message: 'Portfolio data updated successfully' });
  } catch (error) {
    console.error('Error updating portfolio data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get portfolio data endpoint (for reading current state)
app.get('/api/portfolio', (req, res) => {
  try {
    const { path: dataPath } = req.query;
    
    const portfolioData = readPortfolioData();
    
    if (dataPath) {
      const value = getNestedProperty(portfolioData, dataPath);
      res.json({ value });
    } else {
      res.json(portfolioData);
    }
  } catch (error) {
    console.error('Error reading portfolio data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Portfolio server running on http://localhost:${PORT}`);
});

