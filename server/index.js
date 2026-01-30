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
  const sections = ['theaterDirector', 'actress', 'movieDirector', 'assistantDirection'];
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

// Get next available work ID across all categories
function getNextWorkId(portfolioData) {
  if (!portfolioData.works) return 1;
  let maxId = 0;
  const sections = ['theaterDirector', 'actress', 'movieDirector', 'assistantDirection'];
  for (const section of sections) {
    const arr = portfolioData.works[section];
    if (Array.isArray(arr)) {
      for (const work of arr) {
        if (work && typeof work.id === 'number' && work.id > maxId) {
          maxId = work.id;
        }
      }
    }
  }
  return maxId + 1;
}

// Process a work image: resize/compress with ImageMagick, no watermark, target < 200KB
function processWorkImage(sourcePath, destPath) {
  try {
    // Always convert to JPEG for better compression, regardless of input format
    const destPathJpeg = destPath.replace(/\.(png|gif|webp)$/i, '.jpg');
    let quality = 85;
    const maxSize = 200 * 1024; // 200 KB

    for (let attempt = 0; attempt < 10; attempt++) {
      // Resize to max 1920px, strip metadata, convert to JPEG, adjust quality
      // Use -define jpeg:extent to help target file size
      execSync(
        `magick "${sourcePath}" -auto-orient -resize "1920x1920>" -strip -quality ${quality} -define jpeg:extent=${maxSize}b "${destPathJpeg}"`,
        { stdio: 'ignore' }
      );

      const { size } = fs.statSync(destPathJpeg);
      console.log(`Attempt ${attempt + 1}: Quality ${quality}, Size: ${(size / 1024).toFixed(2)} KB`);
      
      if (size <= maxSize || quality <= 30) {
        // If original destPath was different (e.g., .png), we need to rename
        if (destPath !== destPathJpeg && fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        // Rename JPEG to match original extension if needed, or keep as JPEG
        if (destPath !== destPathJpeg) {
          fs.renameSync(destPathJpeg, destPath);
        }
        break;
      }

      // Reduce quality more aggressively
      quality -= 8;
    }

    // Final check - if still too large, try one more time with very low quality
    const finalPath = destPath.endsWith('.jpg') ? destPath : destPathJpeg;
    if (fs.existsSync(finalPath)) {
      const { size } = fs.statSync(finalPath);
      if (size > maxSize) {
        console.log(`Final size ${(size / 1024).toFixed(2)} KB still too large, applying aggressive compression...`);
        execSync(
          `magick "${sourcePath}" -auto-orient -resize "1600x1600>" -strip -quality 50 -define jpeg:extent=${maxSize}b "${destPathJpeg}"`,
          { stdio: 'ignore' }
        );
        if (destPath !== destPathJpeg) {
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          fs.renameSync(destPathJpeg, destPath);
        }
      }
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

// Reorder work gallery images
app.put('/api/works/:workId/images/reorder', async (req, res) => {
  try {
    const workId = Number(req.params.workId);
    const { imageUrl, direction } = req.body || {}; // direction: 'left' or 'right'

    if (!workId || Number.isNaN(workId)) {
      return res.status(400).json({ error: 'Invalid workId' });
    }
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'Image URL is required' });
    }
    if (!direction || !['left', 'right'].includes(direction)) {
      return res.status(400).json({ error: 'Direction must be "left" or "right"' });
    }

    const portfolioData = readPortfolioData();
    const found = findWorkById(portfolioData, workId);

    if (!found) {
      return res.status(404).json({ error: `Work with id ${workId} not found` });
    }

    const { section, index, work } = found;
    if (!Array.isArray(work.images) || work.images.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 images to reorder' });
    }

    const imageIndex = work.images.findIndex((img) => img && img.url === imageUrl);
    if (imageIndex === -1) {
      return res.status(404).json({ error: 'Image not found in work gallery' });
    }

    // Reorder: left moves left (or first to end), right moves right (or last to first)
    if (direction === 'left') {
      if (imageIndex === 0) {
        // First item: move to end
        const [moved] = work.images.splice(0, 1);
        work.images.push(moved);
      } else {
        // Swap with previous
        [work.images[imageIndex - 1], work.images[imageIndex]] = 
          [work.images[imageIndex], work.images[imageIndex - 1]];
      }
    } else { // direction === 'right'
      if (imageIndex === work.images.length - 1) {
        // Last item: move to beginning
        const [moved] = work.images.splice(imageIndex, 1);
        work.images.unshift(moved);
      } else {
        // Swap with next
        [work.images[imageIndex], work.images[imageIndex + 1]] = 
          [work.images[imageIndex + 1], work.images[imageIndex]];
      }
    }

    portfolioData.works[section][index] = work;
    writePortfolioData(portfolioData);

    res.json({ success: true, images: work.images });
  } catch (error) {
    console.error('Reorder work images error:', error);
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

      if (!otherValue && ollama) {
        try {
          otherValue = await translateText(value, primaryLang, otherLang);
        } catch (error) {
          console.warn(
            '⚠️ Auto-translation failed, keeping only primary language:',
            (error && error.message) || error
          );
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

// Upload thumbnail for new work (processes and returns URL)
app.post('/api/works/thumbnail', workUpload.single('thumbnail'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No thumbnail file uploaded' });
    }

    // Create a folder for the new work (using timestamp)
    const timestamp = Date.now();
    const baseFolder = `work-${timestamp}`;
    const worksDir = path.join(__dirname, '..', 'public', 'works', baseFolder);
    if (!fs.existsSync(worksDir)) {
      fs.mkdirSync(worksDir, { recursive: true });
    }

    // Always use .jpg extension for thumbnails (better compression)
    const filename = `thumbnail.jpg`;
    const destPath = path.join(worksDir, filename);

    // Process image with ImageMagick
    const result = processWorkImage(req.file.path, destPath);
    fs.unlinkSync(req.file.path); // Clean up temp file

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to process thumbnail' });
    }

    const urlPath = `/works/${baseFolder}/${filename}`;
    res.json({ url: urlPath, folder: baseFolder });
  } catch (error) {
    console.error('Thumbnail upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// Update thumbnail for existing work
app.put('/api/works/:workId/thumbnail', workUpload.single('thumbnail'), async (req, res) => {
  try {
    const workId = Number(req.params.workId);
    if (!workId || Number.isNaN(workId)) {
      return res.status(400).json({ error: 'Invalid workId' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No thumbnail file uploaded' });
    }

    const portfolioData = readPortfolioData();
    const found = findWorkById(portfolioData, workId);

    if (!found) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: `Work with id ${workId} not found` });
    }

    const { section, index, work } = found;

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

    // Delete old thumbnail if it exists and is a local file
    if (work.thumbnail && typeof work.thumbnail === 'string' && work.thumbnail.startsWith('/works/')) {
      const oldThumbPath = path.join(__dirname, '..', 'public', work.thumbnail);
      if (fs.existsSync(oldThumbPath)) {
        try {
          fs.unlinkSync(oldThumbPath);
        } catch (err) {
          console.warn(`Could not delete old thumbnail: ${oldThumbPath}`, err);
        }
      }
    }

    // Generate unique filename based on timestamp
    const timestamp = Date.now();
    const filename = `thumbnail-${timestamp}.jpg`;
    const destPath = path.join(worksDir, filename);

    // Process image with ImageMagick
    const result = processWorkImage(req.file.path, destPath);
    fs.unlinkSync(req.file.path); // Clean up temp file

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to process thumbnail' });
    }

    const urlPath = `/works/${baseFolder}/${filename}`;

    // Update work thumbnail
    work.thumbnail = urlPath;
    portfolioData.works[section][index] = work;
    writePortfolioData(portfolioData);

    res.json({ success: true, thumbnail: urlPath, work });
  } catch (error) {
    console.error('Thumbnail update error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// Create a new work
app.post('/api/works', async (req, res) => {
  try {
    const { category, title, year, description, thumbnail } = req.body;

    if (!category || !['actress', 'assistantDirection'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Must be "actress" or "assistantDirection"' });
    }
    if (!title || typeof title !== 'object') {
      return res.status(400).json({ error: 'Title is required and must be an object with language keys' });
    }
    if (!year || typeof year !== 'number') {
      return res.status(400).json({ error: 'Year is required and must be a number' });
    }
    if (!description || typeof description !== 'object') {
      return res.status(400).json({ error: 'Description is required and must be an object with language keys' });
    }
    if (!thumbnail || typeof thumbnail !== 'string') {
      return res.status(400).json({ error: 'Thumbnail URL is required' });
    }

    const portfolioData = readPortfolioData();
    
    // Ensure the category array exists
    if (!portfolioData.works) portfolioData.works = {};
    if (!Array.isArray(portfolioData.works[category])) {
      portfolioData.works[category] = [];
    }

    // Get next available ID
    const newId = getNextWorkId(portfolioData);

    // Create new work object
    const newWork = {
      id: newId,
      title: {
        en: title.en || title.es || '',
        es: title.es || title.en || '',
      },
      description: {
        en: description.en || description.es || '',
        es: description.es || description.en || '',
      },
      thumbnail,
      images: [],
      videos: [],
      year,
    };

    // Add to the category array
    portfolioData.works[category].push(newWork);
    writePortfolioData(portfolioData);

    console.log(`✅ Created new work with id ${newId} in category ${category}`);

    res.json({ success: true, work: newWork });
  } catch (error) {
    console.error('Create work error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a video to a work
app.post('/api/works/:workId/videos', async (req, res) => {
  try {
    const workId = Number(req.params.workId);
    const { url } = req.body || {};

    if (!workId || Number.isNaN(workId)) {
      return res.status(400).json({ error: 'Invalid workId' });
    }
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Video URL is required' });
    }

    const portfolioData = readPortfolioData();
    const found = findWorkById(portfolioData, workId);

    if (!found) {
      return res.status(404).json({ error: `Work with id ${workId} not found` });
    }

    const { section, index, work } = found;

    // Validate URL is YouTube or Vimeo
    const isYouTube = /(?:youtube\.com|youtu\.be)/.test(url);
    const isVimeo = /vimeo\.com/.test(url);

    if (!isYouTube && !isVimeo) {
      return res.status(400).json({ error: 'URL must be a YouTube or Vimeo link' });
    }

    // Extract thumbnail URL
    let thumbnail = '';
    if (isYouTube) {
      const youtubeIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
      if (youtubeIdMatch && youtubeIdMatch[1]) {
        thumbnail = `https://img.youtube.com/vi/${youtubeIdMatch[1]}/maxresdefault.jpg`;
      }
    } else if (isVimeo) {
      const vimeoIdMatch = url.match(/vimeo\.com\/(\d+)/);
      if (vimeoIdMatch && vimeoIdMatch[1]) {
        // Vimeo thumbnails require API call, but we can use a placeholder or fetch
        thumbnail = `https://vumbnail.com/${vimeoIdMatch[1]}.jpg`;
      }
    }

    // Initialize videos array if it doesn't exist
    if (!Array.isArray(work.videos)) {
      work.videos = [];
    }

    // Add new video
    const newVideo = {
      url: url.trim(),
      thumbnail,
    };

    work.videos.push(newVideo);
    portfolioData.works[section][index] = work;
    writePortfolioData(portfolioData);

    console.log(`✅ Added video to work ${workId}`);

    res.json({ success: true, video: newVideo });
  } catch (error) {
    console.error('Add video error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a work and all its associated images
app.delete('/api/works/:workId', async (req, res) => {
  try {
    const workId = Number(req.params.workId);
    if (!workId || Number.isNaN(workId)) {
      return res.status(400).json({ error: 'Invalid workId' });
    }

    const portfolioData = readPortfolioData();
    const found = findWorkById(portfolioData, workId);

    if (!found) {
      return res.status(404).json({ error: `Work with id ${workId} not found` });
    }

    const { section, index, work } = found;

    // Collect all image paths to delete
    const imagesToDelete = [];

    // Add thumbnail if it's a local file
    if (work.thumbnail && typeof work.thumbnail === 'string' && work.thumbnail.startsWith('/works/')) {
      imagesToDelete.push(work.thumbnail);
    }

    // Add all gallery images if they're local files
    if (Array.isArray(work.images)) {
      for (const img of work.images) {
        if (img && img.url && typeof img.url === 'string' && img.url.startsWith('/works/')) {
          imagesToDelete.push(img.url);
        }
      }
    }

    // Delete all image files from disk
    for (const imagePath of imagesToDelete) {
      const filePath = path.join(__dirname, '..', 'public', imagePath);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted image: ${imagePath}`);
        }
      } catch (fsErr) {
        console.warn(`Failed to delete image ${imagePath}:`, fsErr);
      }
    }

    // Try to delete the work's folder if it exists and is empty
    if (work.thumbnail && typeof work.thumbnail === 'string' && work.thumbnail.startsWith('/works/')) {
      const segments = work.thumbnail.split('/');
      if (segments.length >= 3 && segments[2]) {
        const workFolder = path.join(__dirname, '..', 'public', 'works', segments[2]);
        try {
          if (fs.existsSync(workFolder)) {
            const files = fs.readdirSync(workFolder);
            if (files.length === 0) {
              fs.rmdirSync(workFolder);
              console.log(`Deleted empty work folder: ${segments[2]}`);
            }
          }
        } catch (fsErr) {
          console.warn(`Failed to delete work folder ${segments[2]}:`, fsErr);
        }
      }
    }

    // Remove work from JSON
    portfolioData.works[section].splice(index, 1);
    writePortfolioData(portfolioData);

    console.log(`✅ Deleted work ${workId} from section ${section}`);

    res.json({ success: true, deletedImages: imagesToDelete.length });
  } catch (error) {
    console.error('Delete work error:', error);
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

