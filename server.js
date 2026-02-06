import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { Ollama } from 'ollama';
import { createCanvas } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8082;

// Initialize Ollama
// Uses OLLAMA_BASE_URL environment variable or defaults to http://localhost:11434
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
let ollama;
try {
  ollama = new Ollama({ host: ollamaBaseUrl });
  console.log(`✅ Ollama initialized with host: ${ollamaBaseUrl}`);
} catch (error) {
  console.warn('⚠️ Ollama not initialized. Auto-translation will be disabled.');
  console.warn('   Make sure Ollama is running and set OLLAMA_BASE_URL if needed.');
  ollama = null;
}

// Helper function to translate text using Ollama
async function translateText(text, sourceLanguage, targetLanguage) {
  if (!ollama) {
    throw new Error('Ollama is not configured. Make sure Ollama is running.');
  }
  
  const sourceLang = sourceLanguage === 'es' ? 'Spanish' : 'English';
  const targetLang = targetLanguage === 'es' ? 'Spanish' : 'English';
  
  const prompt = `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}. Only return the literal translation, no explanations or any factual information. Do not add any additional text, only the translation:\n\n${text}`;
  
  try {
    console.log(`🔄 Translating from ${sourceLang} to ${targetLang}...`);
    const response = await ollama.generate({
      model: process.env.OLLAMA_MODEL || 'mistral', // Default to llama3.2, can be overridden
      prompt: prompt,
      stream: false, // Don't stream, get full response
    });
    
    // Extract the translation from the response
    // Ollama returns { response: string, ... }
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

// Enable CORS with more permissive settings for ngrok
app.use(cors({
  origin: '*', // Allow all origins (for ngrok)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.sendStatus(200);
});

app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const exhibitionId = req.body.exhibitionId || 'temp';
    const uploadDir = path.join(__dirname, 'uploads', exhibitionId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `upload-${timestamp}${ext}`);
  }
});

const upload = multer({ 
  storage,
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
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Check if an ID is a gallery section (not an exhibition)
function isGallerySection(id) {
  const galleryData = readGalleryData();
  return galleryData.gallerySections.some(section => section.id === id);
}

// Get directory name from exhibition ID or gallery section ID
function getExhibitionDirName(exhibitionId) {
  // Check if it's a gallery section
  if (isGallerySection(exhibitionId)) {
    // Gallery sections use their ID as directory name in gallery-sections folder
    return exhibitionId;
  }
  
  // Map exhibition IDs to directory names
  // Some IDs are URL-safe versions of directory names
  const dirMap = {
    '-tm-sferas': 'Àtmósferas',
    'dream-worlds': 'dream-worlds',
    'mediterranean-dance': 'mediterranean-dance',
    'underwater': 'underwater',
    'underwater-carboneria': 'underwater',
    'underwater-babel': 'underwater',
    'nudibranchia': 'nudibranchia',
  };
  
  return dirMap[exhibitionId] || exhibitionId;
}

// Helper functions to read/write galleryData.json
function readGalleryData() {
  const galleryDataPath = path.join(__dirname, 'src', 'data', 'galleryData.json');
  const content = fs.readFileSync(galleryDataPath, 'utf-8');
  return JSON.parse(content);
}

function writeGalleryData(data) {
  const galleryDataPath = path.join(__dirname, 'src', 'data', 'galleryData.json');
  fs.writeFileSync(galleryDataPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Helper functions to read/write portfolioData.json (works for theater/cine)
function readPortfolioData() {
  const portfolioDataPath = path.join(__dirname, 'src', 'data', 'portfolioData.json');
  const content = fs.readFileSync(portfolioDataPath, 'utf-8');
  return JSON.parse(content);
}

function writePortfolioData(data) {
  const portfolioDataPath = path.join(__dirname, 'src', 'data', 'portfolioData.json');
  fs.writeFileSync(portfolioDataPath, JSON.stringify(data, null, 2), 'utf-8');
}

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

// Process a work image: resize and compress with ImageMagick, no watermark, target < 200KB
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

// Find all exhibition IDs that match the pattern (for duplicates like underwater-*)
function findMatchingExhibitionIds(exhibitionId) {
  // For gallery sections, just return the single ID (no duplicates)
  if (isGallerySection(exhibitionId)) {
    return [exhibitionId];
  }
  
  const galleryData = readGalleryData();
  const matchingIds = [];
  
  // Check if this is an underwater-* exhibition
  if (exhibitionId.startsWith('underwater-')) {
    // Find all exhibitions with underwater-* pattern
    galleryData.exhibitions.forEach(exhibition => {
      if (exhibition.id.startsWith('underwater-')) {
        matchingIds.push(exhibition.id);
      }
    });
  } else {
    // For non-underwater exhibitions, just return the single ID
    matchingIds.push(exhibitionId);
  }
  
  return matchingIds.length > 0 ? matchingIds : [exhibitionId];
}

// Get current image count for an exhibition/section from galleryData.json
function getImageCount(exhibitionId, isGallery) {
  try {
    const galleryData = readGalleryData();
    const array = isGallery ? galleryData.gallerySections : galleryData.exhibitions;
    const section = array.find(s => s.id === exhibitionId);
    
    if (!section) {
      console.warn(`getImageCount: Section not found for ${exhibitionId} (isGallery: ${isGallery})`);
      return 0;
    }
    
    const count = section.images ? section.images.length : 0;
    console.log(`getImageCount: Found ${count} images for ${exhibitionId}`);
    return count;
  } catch (error) {
    console.error(`Error in getImageCount for ${exhibitionId}:`, error);
    return 0;
  }
}

// Update state.json to add new image index (0) to the end of the order
// Since new image is added at index 0, all existing images shift by 1
function updateStateWithNewImage(exhibitionId, currentImageCount, isGallery) {
  try {
    const statePath = path.join(__dirname, 'src', 'data', 'state.json');
    console.log(`updateStateWithNewImage: Updating state for ${exhibitionId}, currentImageCount: ${currentImageCount}`);
    
    // Read existing state or create empty object
    let galleryOrders = {};
    if (fs.existsSync(statePath)) {
      try {
        const content = fs.readFileSync(statePath, 'utf-8');
        galleryOrders = JSON.parse(content);
        console.log(`updateStateWithNewImage: Read existing state.json, found ${Object.keys(galleryOrders).length} entries`);
      } catch (error) {
        console.warn('Error reading state.json, creating new file:', error);
        galleryOrders = {};
      }
    } else {
      console.log('updateStateWithNewImage: state.json does not exist, creating new file');
    }
    
    // Find all matching exhibition IDs (for underwater-* duplicates)
    const matchingIds = findMatchingExhibitionIds(exhibitionId);
    console.log(`updateStateWithNewImage: Matching IDs: ${matchingIds.join(', ')}`);
    
    // Update order for all matching exhibitions
    for (const id of matchingIds) {
      let order = galleryOrders[id];
      const hadExistingOrder = order && Array.isArray(order) && order.length > 0;
      
      if (hadExistingOrder) {
        // If order exists, increment all indices by 1 and add 0 at the end
        // This is because the new image is at index 0, shifting all existing images
        const oldOrder = [...order];
        order = order.map(idx => idx + 1);
        order.push(0);
        console.log(`updateStateWithNewImage: Updated existing order for ${id}: [${oldOrder.join(', ')}] -> [${order.join(', ')}]`);
      } else {
        // If no order exists, create one with all indices in order, with 0 at the end
        // The new image count is currentImageCount + 1 (after adding the new image)
        order = [];
        for (let i = 1; i <= currentImageCount; i++) {
          order.push(i);
        }
        order.push(0);
        console.log(`updateStateWithNewImage: Created new order for ${id}: [${order.join(', ')}]`);
      }
      
      galleryOrders[id] = order;
    }
    
    // Write back to file with pretty formatting
    fs.writeFileSync(statePath, JSON.stringify(galleryOrders, null, 2), 'utf-8');
    console.log(`updateStateWithNewImage: Successfully wrote state.json for ${exhibitionId}`);
  } catch (error) {
    console.error(`Error in updateStateWithNewImage for ${exhibitionId}:`, error);
    throw error;
  }
}

// Mark an image as a text image in state.json
function updateTextImageMarker(exhibitionId, imageIndex, isGallery) {
  try {
    const statePath = path.join(__dirname, 'src', 'data', 'state.json');
    
    // Read existing state or create empty object
    let state = {};
    if (fs.existsSync(statePath)) {
      try {
        const content = fs.readFileSync(statePath, 'utf-8');
        state = JSON.parse(content);
      } catch (error) {
        console.warn('Error reading state.json for text image marker:', error);
        state = {};
      }
    }
    
    // Initialize text_images object if it doesn't exist
    if (!state.text_images) {
      state.text_images = {};
    }
    
    // Find all matching exhibition IDs (for underwater-* duplicates)
    const matchingIds = findMatchingExhibitionIds(exhibitionId);
    
    // Mark the image index as a text image for all matching exhibitions
    for (const id of matchingIds) {
      if (!state.text_images[id]) {
        state.text_images[id] = [];
      }
      
      // Add the image index if it's not already there
      if (!state.text_images[id].includes(imageIndex)) {
        state.text_images[id].push(imageIndex);
        console.log(`updateTextImageMarker: Marked image ${imageIndex} as text image for ${id}`);
      }
    }
    
    // Write back to file with pretty formatting
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    console.log(`updateTextImageMarker: ✅ Successfully marked text image in state.json for ${exhibitionId}`);
  } catch (error) {
    console.error(`Error in updateTextImageMarker for ${exhibitionId}:`, error);
    throw error;
  }
}

// Process image: resize, watermark, create thumbnail
function processImage(sourcePath, galleryDir, thumbnailsDir, exhibitionId, isPoster = false, isGallery = false) {
  const timestamp = Date.now();
  const ext = path.extname(sourcePath).toLowerCase();
  const filename = isPoster ? `_poster${ext}` : `image-${timestamp}${ext}`;
  const galleryPath = path.join(galleryDir, filename);
  const thumbnailPath = path.join(thumbnailsDir, filename);
  const dirName = getExhibitionDirName(exhibitionId);

  try {
    // Resize to max 1920px width
    execSync(`sips -Z 1920 "${sourcePath}" --out "${galleryPath}"`, { stdio: 'ignore' });
    
    // Add watermark (only for non-posters and not prensa gallery)
    if (!isPoster && exhibitionId !== 'prensa') {
      execSync(
        `magick "${galleryPath}" -pointsize 42 -font "Trebuchet-MS-Bold" -fill white -gravity southeast -annotate +20+20 "© elma hache" "${galleryPath}"`,
        { stdio: 'ignore' }
      );
    }
    
    // Create thumbnail (200px)
    execSync(`sips -Z 200 "${galleryPath}" --out "${thumbnailPath}"`, { stdio: 'ignore' });
    
    // Determine base path based on whether it's a gallery section or exhibition
    const basePath = isGallery ? '/gallery-sections' : '/gallery';
    
    return {
      filename,
      galleryPath: `${basePath}/${dirName}/${filename}`,
      thumbnailPath: `${basePath}/thumbnails/${dirName}/${filename}`,
      success: true
    };
  } catch (error) {
    console.error('Error processing image:', error);
    return { success: false, error: error.message };
  }
}

// Update galleryData.json for a single exhibition
function updateGalleryDataSingle(exhibitionId, newImage) {
  const galleryData = readGalleryData();
  
  // Find the exhibition
  const exhibition = galleryData.exhibitions.find(e => e.id === exhibitionId);
  if (!exhibition) {
    throw new Error(`Exhibition ${exhibitionId} not found in galleryData.json`);
  }
  
  // Initialize images array if it doesn't exist
  if (!exhibition.images) {
    exhibition.images = [];
  }
  
  // Add new image at the beginning of the array
  exhibition.images.unshift({
    src: newImage.galleryPath,
    thumbnail: newImage.thumbnailPath,
    caption: newImage.filename
  });
  
  // Write back to JSON
  writeGalleryData(galleryData);
  console.log(`✅ Added image to exhibition ${exhibitionId}`);
  return true;
}

// Update galleryData.json (handles duplicates for underwater-*)
function updateGalleryData(exhibitionId, newImage) {
  const matchingIds = findMatchingExhibitionIds(exhibitionId);
  
  // Update all matching exhibitions
  for (const id of matchingIds) {
    try {
      updateGalleryDataSingle(id, newImage);
    } catch (error) {
      console.error(`Error updating exhibition ${id}:`, error);
      throw error;
    }
  }
  
  return true;
}

// Update galleryData.json for a single gallery section
function updateGallerySectionDataSingle(sectionId, newImage) {
  const galleryData = readGalleryData();
  
  // Find the gallery section
  const section = galleryData.gallerySections.find(s => s.id === sectionId);
  if (!section) {
    throw new Error(`Gallery section ${sectionId} not found in galleryData.json`);
  }
  
  // Initialize images array if it doesn't exist
  if (!section.images) {
    section.images = [];
  }
  
  // Add new image at the beginning of the array
  section.images.unshift({
    src: newImage.galleryPath,
    thumbnail: newImage.thumbnailPath,
    caption: newImage.filename
  });
  
  // Write back to JSON
  writeGalleryData(galleryData);
  console.log(`✅ Added image to gallery section ${sectionId}`);
  return true;
}

// Update galleryData.json for gallery section
function updateGallerySectionData(sectionId, newImage) {
  try {
    updateGallerySectionDataSingle(sectionId, newImage);
  } catch (error) {
    console.error(`Error updating gallery section ${sectionId}:`, error);
    throw error;
  }
  return true;
}

// Find image index in galleryData.json before deletion
function findImageIndex(exhibitionId, imageSrc, isGallery) {
  const galleryData = readGalleryData();
  const array = isGallery ? galleryData.gallerySections : galleryData.exhibitions;
  const section = array.find(s => s.id === exhibitionId);
  
  if (!section || !section.images) {
    return -1;
  }
  
  // Find the index of the image with matching src
  const index = section.images.findIndex(img => img.src === imageSrc);
  return index;
}

// Update state.json to remove deleted image index and adjust remaining indices
function updateStateAfterDelete(exhibitionId, deletedIndex, isGallery) {
  try {
    const statePath = path.join(__dirname, 'src', 'data', 'state.json');
    console.log(`updateStateAfterDelete: Updating state for ${exhibitionId}, deletedIndex: ${deletedIndex}, isGallery: ${isGallery}`);
    
    // Read existing state or create empty object
    let galleryOrders = {};
    if (fs.existsSync(statePath)) {
      try {
        const content = fs.readFileSync(statePath, 'utf-8');
        galleryOrders = JSON.parse(content);
        console.log(`updateStateAfterDelete: Read existing state.json, found keys: ${Object.keys(galleryOrders).join(', ')}`);
      } catch (error) {
        console.warn('Error reading state.json:', error);
        galleryOrders = {};
      }
    } else {
      console.warn(`updateStateAfterDelete: state.json does not exist at ${statePath}`);
    }
    
    // Find all matching exhibition IDs (for underwater-* duplicates)
    const matchingIds = findMatchingExhibitionIds(exhibitionId);
    console.log(`updateStateAfterDelete: Matching IDs: ${matchingIds.join(', ')}`);
    
    let updated = false;
    
    // Update order for all matching exhibitions
    for (const id of matchingIds) {
      let order = galleryOrders[id];
      
      if (order && Array.isArray(order) && order.length > 0) {
        const originalOrder = [...order];
        console.log(`updateStateAfterDelete: Original order for ${id}: ${JSON.stringify(order)}`);
        
        // Remove the deleted index from the order
        // Example: if order is [3, 1, 0, 2] and we delete picture at index 1,
        // first remove it: [3, 0, 2]
        const indexToRemove = order.indexOf(deletedIndex);
        if (indexToRemove !== -1) {
          order.splice(indexToRemove, 1);
          console.log(`updateStateAfterDelete: Removed index ${deletedIndex} from position ${indexToRemove}, order now: ${JSON.stringify(order)}`);
        } else {
          console.log(`updateStateAfterDelete: Index ${deletedIndex} not found in order for ${id}`);
        }
        
        // After deleting a picture, the remaining pictures in galleryData.json are reindexed,
        // so we need to adjust all indices greater than deletedIndex by subtracting 1
        // Example: if we had [3, 1, 0, 2] and deleted index 1, pictures shift:
        // - Picture at old index 2 becomes new index 1
        // - Picture at old index 3 becomes new index 2
        // So order [3, 0, 2] needs to become [2, 0, 1]
        order = order.map(idx => {
          if (idx > deletedIndex) {
            return idx - 1;
          }
          return idx;
        });
        
        
        galleryOrders[id] = order;
        updated = true;
        console.log(`updateStateAfterDelete: After adjustment for ${id}: ${JSON.stringify(originalOrder)} -> ${JSON.stringify(galleryOrders[id])}`);
      } else {
        console.log(`updateStateAfterDelete: No existing order for ${id} (order: ${JSON.stringify(order)}), nothing to update`);
      }
    }
    
    if (updated) {
      // Write back to file with pretty formatting
      const jsonContent = JSON.stringify(galleryOrders, null, 2);
      fs.writeFileSync(statePath, jsonContent, 'utf-8');
      
      // Verify the write by reading it back
      try {
        const verifyContent = fs.readFileSync(statePath, 'utf-8');
        const verifyOrders = JSON.parse(verifyContent);
        const verifyOrder = verifyOrders[exhibitionId];
        console.log(`updateStateAfterDelete: ✅ Successfully wrote state.json for ${exhibitionId}`);
        console.log(`updateStateAfterDelete: Verified write - order for ${exhibitionId} in file: ${JSON.stringify(verifyOrder)}`);
        
        // Check if the order in the file matches what we wrote
        if (JSON.stringify(verifyOrder) !== JSON.stringify(galleryOrders[exhibitionId])) {
          console.error(`updateStateAfterDelete: ⚠️ WARNING - Order mismatch! Expected ${JSON.stringify(galleryOrders[exhibitionId])}, got ${JSON.stringify(verifyOrder)}`);
        }
      } catch (verifyError) {
        console.error(`updateStateAfterDelete: Error verifying write:`, verifyError);
      }
    } else {
      console.log(`updateStateAfterDelete: ⚠️ No updates made to state.json for ${exhibitionId}`);
    }
  } catch (error) {
    console.error(`Error in updateStateAfterDelete for ${exhibitionId}:`, error);
    console.error(`Error stack:`, error.stack);
    throw error;
  }
}

// Delete image from gallery section
function removeImageFromGallerySectionDataSingle(sectionId, imageSrc, imageIndex = null) {
  console.log(`removeImageFromGallerySectionDataSingle: sectionId=${sectionId}, imageSrc=${imageSrc}, imageIndex=${imageIndex}`);
  const galleryData = readGalleryData();
  
  // Find the gallery section
  const section = galleryData.gallerySections.find(s => s.id === sectionId);
  if (!section) {
    throw new Error(`Gallery section ${sectionId} not found in galleryData.json`);
  }
  
  if (!section.images || section.images.length === 0) {
    throw new Error(`Gallery section ${sectionId} has no images`);
  }
  
  // Remove image by index if provided, otherwise by src
  if (imageIndex !== null && imageIndex >= 0) {
    if (imageIndex >= section.images.length) {
      throw new Error(`Image index ${imageIndex} is out of bounds (array has ${section.images.length} items)`);
    }
    section.images.splice(imageIndex, 1);
    console.log(`removeImageFromGallerySectionDataSingle: ✅ Removed image at index ${imageIndex}`);
  } else {
    // Remove by src
    const index = section.images.findIndex(img => img.src === imageSrc);
    if (index === -1) {
      throw new Error(`Could not find image with src="${imageSrc}" in galleryData.json`);
    }
    section.images.splice(index, 1);
    console.log(`removeImageFromGallerySectionDataSingle: ✅ Removed image with src="${imageSrc}"`);
  }
  
  // Write back to JSON
  writeGalleryData(galleryData);
  return true;
}

// Delete image from gallery section
function removeImageFromGallerySectionData(sectionId, imageSrc, imageIndex = null) {
  try {
    removeImageFromGallerySectionDataSingle(sectionId, imageSrc, imageIndex);
  } catch (error) {
    console.error(`Error removing image from gallery section ${sectionId}:`, error);
    throw error;
  }
  return true;
}

// Upload endpoint
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    console.log('=== UPLOAD REQUEST RECEIVED ===');
    console.log('File:', req.file ? req.file.originalname : 'No file');
    console.log('Body:', req.body);
    
    if (!req.file) {
      console.log('ERROR: No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { exhibitionId, isPoster } = req.body;
    console.log(`Upload: exhibitionId=${exhibitionId}, isPoster=${isPoster}`);
    
    if (!exhibitionId) {
      console.log('ERROR: exhibitionId is required');
      return res.status(400).json({ error: 'exhibitionId is required' });
    }

    // Get directory name from exhibition ID or gallery section ID
    const dirName = getExhibitionDirName(exhibitionId);
    const isGallery = isGallerySection(exhibitionId);
    
    // Create directories - use gallery-sections for gallery sections, gallery for exhibitions
    const baseDir = isGallery ? 'gallery-sections' : 'gallery';
    const galleryDir = path.join(__dirname, 'public', baseDir, dirName);
    const thumbnailsDir = path.join(__dirname, 'public', baseDir, 'thumbnails', dirName);
    
    [galleryDir, thumbnailsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Process the image
    const result = processImage(
      req.file.path,
      galleryDir,
      thumbnailsDir,
      exhibitionId,
      isPoster === 'true',
      isGallery
    );

    if (!result.success) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: result.error });
    }

    // Update galleryData.json if not a poster
    console.log(`Upload: Checking isPoster - isPoster="${isPoster}", isPoster !== 'true'=${isPoster !== 'true'}`);
    if (isPoster !== 'true') {
      console.log(`Upload: Entering galleryData.json update block for ${exhibitionId} (isGallery: ${isGallery})`);
      try {
        // Get current image count before adding new image
        console.log(`Upload: Calling getImageCount(${exhibitionId}, ${isGallery})`);
        const currentImageCount = getImageCount(exhibitionId, isGallery);
        console.log(`Upload: Current image count for ${exhibitionId}: ${currentImageCount}`);
        
        if (isGallery) {
          console.log(`Upload: Calling updateGallerySectionData for ${exhibitionId}`);
          updateGallerySectionData(exhibitionId, {
            galleryPath: result.galleryPath,
            thumbnailPath: result.thumbnailPath,
            filename: result.filename
          });
          console.log(`Upload: Successfully called updateGallerySectionData`);
        } else {
          console.log(`Upload: Calling updateGalleryData for ${exhibitionId}`);
          updateGalleryData(exhibitionId, {
            galleryPath: result.galleryPath,
            thumbnailPath: result.thumbnailPath,
            filename: result.filename
          });
          console.log(`Upload: Successfully called updateGalleryData`);
        }
        
        // Update state.json to add new image index to the end of the order
        console.log(`Upload: About to call updateStateWithNewImage(${exhibitionId}, ${currentImageCount}, ${isGallery})`);
        try {
          updateStateWithNewImage(exhibitionId, currentImageCount, isGallery);
          console.log(`Upload: ✅ Successfully updated state.json for ${exhibitionId}`);
        } catch (stateError) {
          console.error('Upload: ❌ Error updating state.json:', stateError);
          console.error('Upload: State error details:', stateError.message);
          console.error('Upload: State error stack:', stateError.stack);
          // Don't fail the upload if state update fails, but log it
        }
      } catch (error) {
        console.error('Upload: ❌ Error updating galleryData.json:', error);
        console.error('Upload: Error details:', error.message);
        console.error('Upload: Error stack:', error.stack);
        // Continue even if update fails
      }
    } else {
      console.log(`Upload: Skipping galleryData.json update because isPoster is 'true'`);
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      image: {
        src: result.galleryPath,
        thumbnail: result.thumbnailPath,
        caption: result.filename
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// Upload work gallery image (used by Works detail page photo gallery)
// Each image is uploaded individually; it is resized/compressed with ImageMagick (no watermark)
// and appended to the end of the corresponding work's images array in portfolioData.json
app.post('/api/works/:workId/images', upload.single('image'), async (req, res) => {
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

    // Read current portfolio data and locate the work
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

    const worksDir = path.join(__dirname, 'public', 'works', baseFolder);
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

    // Persist back to portfolioData.json
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

// Function to create an image from text
function createTextImage(text, outputPath, width = 1920, height = 1080) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill with black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  
  // Set text style
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Calculate font size based on text length and canvas size
  const maxWidth = width * 0.8; // Use 80% of canvas width
  const minFontSize = 24;
  const maxFontSize = 48;
  let fontSize = maxFontSize;
  
  // Try to fit text by reducing font size
  ctx.font = `bold ${fontSize}px Arial`;
  const metrics = ctx.measureText(text);
  
  if (metrics.width > maxWidth) {
    fontSize = Math.max(minFontSize, (maxWidth / metrics.width) * fontSize);
    ctx.font = `bold ${fontSize}px Arial`;
  }
  
  // Handle multi-line text (split by newlines)
  const lines = text.split('\n');
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  const startY = (height - totalHeight) / 2 + lineHeight / 2;
  
  // Draw each line
  lines.forEach((line, index) => {
    const y = startY + (index * lineHeight);
    ctx.fillText(line, width / 2, y);
  });
  
  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  
  return true;
}

// Create text image endpoint
app.post('/api/create-text-image', async (req, res) => {
  try {
    console.log('=== CREATE TEXT IMAGE REQUEST RECEIVED ===');
    const { text, exhibitionId, isGallery } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    if (!exhibitionId) {
      return res.status(400).json({ error: 'exhibitionId is required' });
    }
    
    const isGallerySection = isGallery === true || isGallery === 'true';
    console.log(`CreateTextImage: exhibitionId=${exhibitionId}, isGallery=${isGallerySection}`);
    
    // Get directory name
    const dirName = getExhibitionDirName(exhibitionId);
    const baseDir = isGallerySection ? 'gallery-sections' : 'gallery';
    const galleryDir = path.join(__dirname, 'public', baseDir, dirName);
    const thumbnailsDir = path.join(__dirname, 'public', baseDir, 'thumbnails', dirName);
    
    // Create directories if they don't exist
    [galleryDir, thumbnailsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    // Generate filenames
    const timestamp = Date.now();
    const filename = `text-${timestamp}.png`;
    const galleryPath = path.join(galleryDir, filename);
    const thumbnailPath = path.join(thumbnailsDir, filename);
    
    // Create the text image (1920x1080)
    createTextImage(text.trim(), galleryPath, 1920, 1080);
    
    // Create thumbnail (200px max)
    execSync(`sips -Z 200 "${galleryPath}" --out "${thumbnailPath}"`, { stdio: 'ignore' });
    
    // Determine base path for URLs
    const basePath = isGallerySection ? '/gallery-sections' : '/gallery';
    const galleryUrlPath = `${basePath}/${dirName}/${filename}`;
    const thumbnailUrlPath = `${basePath}/thumbnails/${dirName}/${filename}`;
    
    // Update galleryData.json
    const currentImageCount = getImageCount(exhibitionId, isGallerySection);
    
    if (isGallerySection) {
      updateGallerySectionData(exhibitionId, {
        galleryPath: galleryUrlPath,
        thumbnailPath: thumbnailUrlPath,
        filename: filename
      });
    } else {
      updateGalleryData(exhibitionId, {
        galleryPath: galleryUrlPath,
        thumbnailPath: thumbnailUrlPath,
        filename: filename
      });
    }
    
    // Update state.json
    try {
      updateStateWithNewImage(exhibitionId, currentImageCount, isGallerySection);
      updateTextImageMarker(exhibitionId, currentImageCount, isGallerySection);
      console.log(`CreateTextImage: ✅ Successfully updated state.json for ${exhibitionId}`);
    } catch (stateError) {
      console.error('CreateTextImage: ❌ Error updating state.json:', stateError);
    }
    
    res.json({
      success: true,
      image: {
        src: galleryUrlPath,
        thumbnail: thumbnailUrlPath,
        caption: filename
      }
    });
  } catch (error) {
    console.error('CreateTextImage error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete image from gallery for a single exhibition
function removeImageFromGalleryDataSingle(exhibitionId, imageSrc, imageIndex = null) {
  console.log(`removeImageFromGalleryDataSingle: exhibitionId=${exhibitionId}, imageSrc=${imageSrc}, imageIndex=${imageIndex}`);
  const galleryData = readGalleryData();
  
  // Find the exhibition
  const exhibition = galleryData.exhibitions.find(e => e.id === exhibitionId);
  if (!exhibition) {
    throw new Error(`Exhibition ${exhibitionId} not found in galleryData.json`);
  }
  
  if (!exhibition.images || exhibition.images.length === 0) {
    throw new Error(`Exhibition ${exhibitionId} has no images`);
  }
  
  // Remove image by index if provided, otherwise by src
  if (imageIndex !== null && imageIndex >= 0) {
    if (imageIndex >= exhibition.images.length) {
      throw new Error(`Image index ${imageIndex} is out of bounds (array has ${exhibition.images.length} items)`);
    }
    exhibition.images.splice(imageIndex, 1);
    console.log(`removeImageFromGalleryDataSingle: ✅ Removed image at index ${imageIndex}`);
  } else {
    // Remove by src
    const index = exhibition.images.findIndex(img => img.src === imageSrc);
    if (index === -1) {
      throw new Error(`Could not find image with src="${imageSrc}" in galleryData.json`);
    }
    exhibition.images.splice(index, 1);
    console.log(`removeImageFromGalleryDataSingle: ✅ Removed image with src="${imageSrc}"`);
  }
  
  // Write back to JSON
  writeGalleryData(galleryData);
  return true;
}

// Delete image from gallery (handles duplicates for underwater-*)
function removeImageFromGalleryData(exhibitionId, imageSrc, imageIndex = null) {
  const matchingIds = findMatchingExhibitionIds(exhibitionId);
  
  // Remove from all matching exhibitions
  for (const id of matchingIds) {
    try {
      removeImageFromGalleryDataSingle(id, imageSrc, imageIndex);
    } catch (error) {
      console.error(`Error removing image from exhibition ${id}:`, error);
      throw error;
    }
  }
  
  return true;
}

// Delete endpoint
app.delete('/api/delete', async (req, res) => {
  try {
    console.log('=== DELETE REQUEST RECEIVED ===');
    const { exhibitionId, imageSrc } = req.body;
    console.log(`Delete: exhibitionId=${exhibitionId}, imageSrc=${imageSrc}`);
    
    if (!exhibitionId || !imageSrc) {
      console.log('ERROR: exhibitionId and imageSrc are required');
      return res.status(400).json({ error: 'exhibitionId and imageSrc are required' });
    }

    // Get directory name from exhibition ID or gallery section ID
    const dirName = getExhibitionDirName(exhibitionId);
    const isGallery = isGallerySection(exhibitionId);
    console.log(`Delete: dirName=${dirName}, isGallery=${isGallery}`);
    
    // Find the image index directly from galleryData.json by matching imageSrc
    // This gives us the original index in the images array
    console.log(`Delete: Finding image index from galleryData.json...`);
    const deletedIndex = findImageIndex(exhibitionId, imageSrc, isGallery);
    console.log(`Delete: Found image at original index ${deletedIndex}`);
    
    if (deletedIndex === -1) {
      console.warn(`Delete: Image index not found, but continuing with deletion using regex fallback`);
    }
    
    // Extract filename from imageSrc
    const filename = path.basename(imageSrc);
    
    // Delete full-size image - use gallery-sections for gallery sections, gallery for exhibitions
    const baseDir = isGallery ? 'gallery-sections' : 'gallery';
    const galleryPath = path.join(__dirname, 'public', baseDir, dirName, filename);
    if (fs.existsSync(galleryPath)) {
      fs.unlinkSync(galleryPath);
      console.log(`Delete: Deleted full-size image: ${galleryPath}`);
    } else {
      console.warn(`Delete: Full-size image not found: ${galleryPath}`);
    }
    
    // Delete thumbnail
    const thumbnailPath = path.join(__dirname, 'public', baseDir, 'thumbnails', dirName, filename);
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
      console.log(`Delete: Deleted thumbnail: ${thumbnailPath}`);
    } else {
      console.warn(`Delete: Thumbnail not found: ${thumbnailPath}`);
    }
    
    // Remove from galleryData.ts using the index
    try {
      console.log(`Delete: Removing from galleryData.json using index ${deletedIndex}...`);
      if (isGallery) {
        removeImageFromGallerySectionData(exhibitionId, imageSrc, deletedIndex);
      } else {
        removeImageFromGalleryData(exhibitionId, imageSrc, deletedIndex);
      }
      console.log(`Delete: Successfully removed from galleryData.json`);
    } catch (error) {
      console.error('Delete: Error removing from galleryData.json:', error);
      return res.status(500).json({ error: 'Failed to update galleryData.json' });
    }
    
    // Update state.json to remove the deleted index and adjust remaining indices
    if (deletedIndex !== -1) {
      try {
        console.log(`Delete: Updating state.json...`);
        updateStateAfterDelete(exhibitionId, deletedIndex, isGallery);
        console.log(`Delete: ✅ Successfully updated state.json`);
      } catch (stateError) {
        console.error('Delete: Error updating state.json:', stateError);
        // Don't fail the delete if state update fails, but log it
      }
    } else {
      console.warn(`Delete: Could not update state.json because image index was not found`);
    }

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Delete: ❌ Error:', error);
    console.error('Delete: Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Get gallery order for an exhibition
app.get('/api/gallery-order/:exhibitionId', (req, res) => {
  try {
    const { exhibitionId } = req.params;
    const statePath = path.join(__dirname, 'src', 'data', 'state.json');
    
    if (!fs.existsSync(statePath)) {
      return res.json({ order: null });
    }
    
    let galleryOrders = {};
    try {
      const content = fs.readFileSync(statePath, 'utf-8');
      galleryOrders = JSON.parse(content);
    } catch (error) {
      console.warn('Error reading state.json:', error);
      return res.json({ order: null });
    }
    
    // Handle gallery-sections and exhibitions (special cases, not individual exhibitions)
    if (exhibitionId === 'gallery-sections') {
      const order = galleryOrders['gallery-sections'] || null;
      return res.json({ order });
    }
    
    if (exhibitionId === 'exhibitions') {
      const order = galleryOrders['exhibitions'] || null;
      return res.json({ order });
    }
    
    // For underwater-* exhibitions, check any matching one
    if (exhibitionId.startsWith('underwater-')) {
      // Find any underwater-* order
      const matchingIds = findMatchingExhibitionIds(exhibitionId);
      for (const id of matchingIds) {
        if (galleryOrders[id]) {
          return res.json({ order: galleryOrders[id] });
        }
      }
      return res.json({ order: null });
    }
    
    // Return the order for this exhibition, or null if not found
    const order = galleryOrders[exhibitionId] || null;
    res.json({ order });
  } catch (error) {
    console.error('Error reading gallery order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save gallery order for an exhibition
app.post('/api/gallery-order', async (req, res) => {
  try {
    const { exhibitionId, order } = req.body;
    
    // #region agent log
    fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1014',message:'POST /api/gallery-order: entry',data:{exhibitionId,order,hasIndex8:order?.includes(8),orderLength:order?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');
    // #endregion
    
    if (!exhibitionId || !Array.isArray(order)) {
      return res.status(400).json({ error: 'exhibitionId and order array are required' });
    }
    
    const statePath = path.join(__dirname, 'src', 'data', 'state.json');
    
    // Read existing state or create empty object
    // IMPORTANT: Always read fresh from disk to avoid race conditions with other endpoints
    let galleryOrders = {};
    if (fs.existsSync(statePath)) {
      try {
        const content = fs.readFileSync(statePath, 'utf-8');
        galleryOrders = JSON.parse(content);
        console.log(`POST /api/gallery-order: Read state.json for ${exhibitionId}, existing order: ${JSON.stringify(galleryOrders[exhibitionId])}`);
      } catch (error) {
        console.warn('Error reading state.json, creating new file:', error);
        galleryOrders = {};
      }
    }
    
    // #region agent log
    fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1036',message:'POST /api/gallery-order: before save',data:{exhibitionId,previousOrder:galleryOrders['gallery-sections'],previousHasIndex8:galleryOrders['gallery-sections']?.includes(8)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');
    // #endregion
    
    // #region agent log
    const galleryData = readGalleryData();
    const maxValidIndex = galleryData.gallerySections.length - 1;
    const invalidIndicesInOrder = order.filter(idx => idx < 0 || idx > maxValidIndex);
    fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1044',message:'POST /api/gallery-order: before save validation',data:{exhibitionId,gallerySectionsLength:galleryData.gallerySections.length,maxValidIndex,order,invalidIndicesInOrder,orderContainsInvalid:invalidIndicesInOrder.length>0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');
    // #endregion
    
    // Special handling for gallery-sections and exhibitions (not individual exhibitions)
    if (exhibitionId === 'gallery-sections') {
      galleryOrders['gallery-sections'] = order;
    } else if (exhibitionId === 'exhibitions') {
      galleryOrders['exhibitions'] = order;
    } else {
      // Find all matching exhibition IDs (for underwater-* duplicates)
      const matchingIds = findMatchingExhibitionIds(exhibitionId);
      
      // #region agent log
      const previousOrderForId = matchingIds.length > 0 ? galleryOrders[matchingIds[0]] : null;
      fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1096',message:'POST /api/gallery-order: for individual section/exhibition',data:{exhibitionId,matchingIds,previousOrder:previousOrderForId,newOrder:order},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');
      // #endregion
      
      // For individual gallery sections/exhibitions, validate that the order indices are valid
      // This prevents overwriting with stale data after a deletion
      const isGallery = isGallerySection(exhibitionId);
      let maxValidIndex = -1;
      
      if (isGallery) {
        const section = galleryData.gallerySections.find(s => s.id === exhibitionId);
        if (section && section.images) {
          maxValidIndex = section.images.length - 1;
        }
      } else {
        const exhibition = galleryData.exhibitions.find(e => e.id === exhibitionId);
        if (exhibition && exhibition.images) {
          maxValidIndex = exhibition.images.length - 1;
        }
      }
      
      // Check if any indices in the order are out of bounds (stale data)
      const invalidIndices = order.filter(idx => idx < 0 || idx > maxValidIndex);
      
      if (invalidIndices.length > 0) {
        // Frontend is sending stale data (likely after a deletion)
        console.warn(`POST /api/gallery-order: ⚠️ Rejecting stale order for ${exhibitionId}. Invalid indices: ${JSON.stringify(invalidIndices)}. Max valid index: ${maxValidIndex}. Order: ${JSON.stringify(order)}`);
        console.warn(`POST /api/gallery-order: Keeping existing order: ${JSON.stringify(previousOrderForId)}`);
        
        // #region agent log
        fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1125',message:'POST /api/gallery-order: REJECTED stale order',data:{exhibitionId,maxValidIndex,invalidIndices,rejectedOrder:order,existingOrder:previousOrderForId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');
        // #endregion
        
        // Don't overwrite - keep the existing order (which was updated by updateStateAfterDelete)
        // The existing order is already in galleryOrders, so we just don't update it
        // This preserves the correct state that was set by updateStateAfterDelete
        if (previousOrderForId && previousOrderForId.length > 0) {
          console.log(`POST /api/gallery-order: ✅ Preserved existing order for ${exhibitionId}: ${JSON.stringify(previousOrderForId)}`);
          // galleryOrders already has the correct order, so we don't need to update it
        } else {
          // No existing order, but we can't save invalid data
          console.warn(`POST /api/gallery-order: No existing order to preserve for ${exhibitionId}, but rejecting invalid order`);
          // Don't save anything for this ID
        }
      } else {
        // Order is valid, proceed with update
        console.log(`POST /api/gallery-order: ✅ Valid order for ${exhibitionId}, updating to: ${JSON.stringify(order)}`);
        
        // Update or add the order for all matching exhibitions
        for (const id of matchingIds) {
          galleryOrders[id] = order;
        }
      }
    }
    
    // Write back to file with pretty formatting
    fs.writeFileSync(statePath, JSON.stringify(galleryOrders, null, 2), 'utf-8');
    
    // #region agent log
    // Verify what was actually written for the specific ID if it's an individual section
    if (exhibitionId !== 'gallery-sections' && exhibitionId !== 'exhibitions') {
      try {
        const verifyContent = fs.readFileSync(statePath, 'utf-8');
        const verifyOrders = JSON.parse(verifyContent);
        const verifyOrder = verifyOrders[exhibitionId];
        fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1113',message:'POST /api/gallery-order: verified write',data:{exhibitionId,expectedOrder:order,actualOrderInFile:verifyOrder,matches:JSON.stringify(order)===JSON.stringify(verifyOrder)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');
      } catch (verifyError) {
        // Ignore verification errors
      }
    }
    // #endregion
    
    // #region agent log
    fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1062',message:'POST /api/gallery-order: after save',data:{savedOrder:galleryOrders['gallery-sections'],savedHasIndex8:galleryOrders['gallery-sections']?.includes(8),savedOrderLength:galleryOrders['gallery-sections']?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');
    // #endregion
    
    res.json({ success: true, message: 'Order saved successfully' });
  } catch (error) {
    console.error('Error saving gallery order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get exhibitions list
app.get('/api/exhibitions', (req, res) => {
  try {
    const galleryData = readGalleryData();
    
    // Extract exhibition IDs and titles
    const exhibitions = galleryData.exhibitions.map(ex => ({
      id: ex.id,
      title: ex.title
    }));
    
    res.json({ exhibitions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new gallery section
app.post('/api/create-gallery-section', upload.fields([
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, subtitle } = req.body;
    
    if (!name || !subtitle) {
      return res.status(400).json({ error: 'name and subtitle are required' });
    }
    
    if (!req.files || !req.files.thumbnail || req.files.thumbnail.length === 0) {
      return res.status(400).json({ error: 'thumbnail image is required' });
    }
    
    // Generate section ID from name (URL-safe)
    const sectionId = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Create directories
    const galleryDir = path.join(__dirname, 'public', 'gallery-sections', sectionId);
    const thumbnailsDir = path.join(__dirname, 'public', 'gallery-sections', 'thumbnails', sectionId);
    
    [galleryDir, thumbnailsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    // Process thumbnail (as poster)
    const thumbnailFile = req.files.thumbnail[0];
    const result = processImage(
      thumbnailFile.path,
      galleryDir,
      thumbnailsDir,
      sectionId,
      true, // isPoster
      true  // isGallery
    );
    
    if (!result.success) {
      fs.unlinkSync(thumbnailFile.path);
      return res.status(500).json({ error: result.error });
    }
    
    // Add gallery section to galleryData.json
    const galleryData = readGalleryData();
    
    // Create new gallery section
    const newSection = {
      id: sectionId,
      title: name,
      subtitle: subtitle,
      thumbnail: result.galleryPath,
      images: []
    };
    
    // Add to beginning of gallerySections array
    galleryData.gallerySections.unshift(newSection);
    
    // Write back to JSON
    writeGalleryData(galleryData);
    console.log(`✅ Added gallery section "${sectionId}" to galleryData.json`);
    
    // Auto-translate subtitle and save to translations file
    try {
      const translationKey = `gallery.sections.${sectionId}.subtitle`;
      const esSubtitle = subtitle; // Subtitle is provided in Spanish (default language)
      let enSubtitle = '';
      
      if (ollama) {
        // Translate subtitle from Spanish to English
        console.log('🔄 Auto-translating subtitle from ES to EN...');
        try {
          enSubtitle = await translateText(subtitle, 'es', 'en');
          console.log(`✅ Auto-translated subtitle to EN: ${enSubtitle.substring(0, 100)}...`);
        } catch (error) {
          console.warn('⚠️ Auto-translation failed, continuing with ES only:', error.message);
          // If translation fails, use the same text for both (fallback)
          enSubtitle = subtitle;
        }
      } else {
        // No Ollama configured, use same text for both languages
        console.warn('⚠️ Ollama not configured. Using same text for both languages.');
        enSubtitle = subtitle;
      }
      
      // Update translations file
      const translationsPath = path.join(__dirname, 'src', 'translations', 'index.ts');
      
      if (fs.existsSync(translationsPath)) {
        // Read and parse the translations file
        let content = fs.readFileSync(translationsPath, 'utf-8');
        
        // Extract the translations object from the file
        const objectMatch = content.match(/export const translations = (\{[\s\S]*\});/);
        if (objectMatch) {
          // Parse the object as JavaScript
          let translations;
          try {
            translations = eval(`(${objectMatch[1]})`);
          } catch (error) {
            console.error('Error parsing translations object:', error);
            throw error;
          }
          
          // Update the translations using dot notation
          const esPath = `es.${translationKey}`;
          const enPath = `en.${translationKey}`;
          setNestedProperty(translations, esPath, esSubtitle);
          setNestedProperty(translations, enPath, enSubtitle);
          
          console.log(`✅ Updated translations for ${translationKey}`);
          
          // Format and write back to file
          const formattedObject = formatTranslationsObject(translations);
          const newContent = `export const translations = ${formattedObject};\n`;
          
          fs.writeFileSync(translationsPath, newContent, 'utf-8');
          console.log(`✅ Successfully updated translations file with subtitle translations`);
        } else {
          console.warn('⚠️ Could not parse translations file structure');
        }
      } else {
        console.warn('⚠️ Translations file not found');
      }
    } catch (error) {
      console.error('⚠️ Error auto-translating subtitle:', error);
      // Don't fail the request if translation fails
    }
    
    // Clean up uploaded file
    fs.unlinkSync(thumbnailFile.path);
    
    res.json({
      success: true,
      section: {
        id: sectionId,
        name,
        subtitle,
        thumbnail: result.galleryPath
      }
    });
  } catch (error) {
    console.error('Create gallery section error:', error);
    if (req.files && req.files.thumbnail) {
      req.files.thumbnail.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete gallery section endpoint
app.delete('/api/delete-gallery-section', async (req, res) => {
  try {
    const { sectionId } = req.body;
    
    // #region agent log
    fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1250',message:'DELETE /api/delete-gallery-section: entry',data:{sectionId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n');
    // #endregion
    
    if (!sectionId) {
      return res.status(400).json({ error: 'sectionId is required' });
    }
    
    console.log(`Delete gallery section: ${sectionId}`);
    
    // Read galleryData.json
    const galleryData = readGalleryData();
    
    // Find the section index
    const sectionIndex = galleryData.gallerySections.findIndex(s => s.id === sectionId);
    if (sectionIndex === -1) {
      return res.status(404).json({ error: `Gallery section "${sectionId}" not found in galleryData.json` });
    }
    
    console.log(`Delete: Found section "${sectionId}" at index ${sectionIndex}`);
    
    // #region agent log
    fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1269',message:'DELETE /api/delete-gallery-section: found index',data:{sectionId,sectionIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n');
    // #endregion
    
    // Remove the section from the array
    galleryData.gallerySections.splice(sectionIndex, 1);
    
    // Write back to JSON
    writeGalleryData(galleryData);
    console.log(`✅ Removed gallery section "${sectionId}" from galleryData.json`);
    
    // Update state.json - remove the deleted index and adjust remaining indices
    {
      const statePath = path.join(__dirname, 'src', 'data', 'state.json');
      if (fs.existsSync(statePath)) {
        try {
          let galleryOrders = {};
          const stateContent = fs.readFileSync(statePath, 'utf-8');
          galleryOrders = JSON.parse(stateContent);
          
          // Update gallery-sections order in state.json
          if (galleryOrders['gallery-sections']) {
            let order = galleryOrders['gallery-sections'];
            
            // #region agent log
            fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1291',message:'DELETE /api/delete-gallery-section: before order update',data:{previousOrder:order,previousHasIndex8:order.includes(8),sectionIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n');
            // #endregion
            
            // #region agent log
            const indicesBeforeRemove = [...order];
            const hasDeletedIndex = order.includes(sectionIndex);
            const indicesGreaterThanDeleted = order.filter(idx => idx > sectionIndex);
            const indicesLessThanOrEqual = order.filter(idx => idx <= sectionIndex);
            fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1302',message:'DELETE /api/delete-gallery-section: before order manipulation',data:{sectionIndex,orderBeforeRemove:indicesBeforeRemove,hasDeletedIndex,indicesGreaterThanDeleted,indicesLessThanOrEqual},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})+'\n');
            // #endregion
            
            // Remove the deleted index from order
            const indexToRemove = order.indexOf(sectionIndex);
            if (indexToRemove !== -1) {
              order.splice(indexToRemove, 1);
            }
            
            // #region agent log
            const orderAfterRemove = [...order];
            fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1310',message:'DELETE /api/delete-gallery-section: after remove deleted index',data:{indexToRemove,orderAfterRemove},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})+'\n');
            // #endregion
            
            // Adjust all indices greater than sectionIndex by subtracting 1
            // CRITICAL: After deletion, gallerySections length is reduced by 1, so filter out any indices that are now out of bounds
            const newGallerySectionsLength = galleryData.gallerySections.length; // After deletion, this is already reduced
            
            // #region agent log
            fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1330',message:'DELETE: before index adjustment',data:{sectionIndex,orderBeforeAdjust:order,newGallerySectionsLength,orderLength:order.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})+'\n');
            // #endregion
            
            order = order
              .map(idx => {
                if (idx > sectionIndex) {
                  return idx - 1;
                }
                return idx;
              })
              .filter(idx => idx >= 0 && idx < newGallerySectionsLength); // Remove any invalid indices
            
            // #region agent log
            fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1343',message:'DELETE: after index adjustment',data:{orderAfterAdjust:order,orderLength:order.length,removedIndicesCount:orderAfterRemove.length-order.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})+'\n');
            // #endregion
            
            // #region agent log
            const invalidIndicesAfterAdjust = order.filter(idx => idx < 0 || idx >= newGallerySectionsLength);
            fs.appendFileSync('/Users/darkua/code/underwater-magic-portal/.cursor/debug.log', JSON.stringify({location:'server.js:1333',message:'DELETE /api/delete-gallery-section: after order update',data:{newOrder:order,newGallerySectionsLength,newHasIndex8:order.includes(8),index8Became7:sectionIndex===8,adjustedIndices:order.filter((idx,i)=>idx!==orderAfterRemove[i]),invalidIndicesAfterAdjust},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})+'\n');
            // #endregion
            
            galleryOrders['gallery-sections'] = order;
            console.log(`✅ Updated gallery-sections order in state.json: removed index ${sectionIndex}`);
            
            // Write updated state back
            fs.writeFileSync(statePath, JSON.stringify(galleryOrders, null, 2), 'utf-8');
            console.log(`✅ Updated state.json`);
          }
        } catch (error) {
          console.warn('⚠️ Error updating state.json:', error);
          // Don't fail if state update fails
        }
      }
    }
    
    res.json({
      success: true,
      message: `Gallery section "${sectionId}" deleted successfully`
    });
  } catch (error) {
    console.error('Delete gallery section error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to set nested property using dot notation
function setNestedProperty(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

// Helper function to check if a key needs to be quoted
function needsQuoting(key) {
  // Quote keys that:
  // - Start with a non-letter character (like '-', '_', numbers)
  // - Contain special characters (like '-', spaces, etc.)
  // - Are not valid JavaScript identifiers
  return /^[^a-zA-Z_]|[^a-zA-Z0-9_$]/.test(key);
}

// Helper function to format TypeScript object with proper indentation
// Matches the style: single quotes, 2-space indentation
function formatTranslationsObject(translations) {
  const formatValue = (value, indent = 0) => {
    if (typeof value === 'string') {
      // Escape special characters and handle newlines
      // Use single quotes as in the original file
      const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
      return `'${escaped}'`;
    } else if (Array.isArray(value)) {
      return `[${value.map(v => formatValue(v, indent + 1)).join(', ')}]`;
    } else if (typeof value === 'object' && value !== null) {
      return formatObject(value, indent);
    }
    return String(value);
  };

  const formatObject = (obj, indent = 0) => {
    const indentStr = '  '.repeat(indent);
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    
    const lines = entries.map(([key, value]) => {
      // Quote keys that need it
      const formattedKey = needsQuoting(key) ? `'${key}'` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nested = formatObject(value, indent + 1);
        return `${indentStr}${formattedKey}: ${nested},`;
      } else {
        const formatted = formatValue(value, indent);
        return `${indentStr}${formattedKey}: ${formatted},`;
      }
    });
    return `{\n${lines.join('\n')}\n${indentStr}}`;
  };

  return formatObject(translations, 0);
}

// Update translation endpoint
app.put('/api/translations', async (req, res) => {
  try {
    let { key, es, en } = req.body;
    
    console.log('=== UPDATE TRANSLATION REQUEST ===');
    console.log(`Key: ${key}`);
    console.log(`ES: ${es !== undefined ? (es.substring(0, 100) + '...') : 'undefined'}`);
    console.log(`EN: ${en !== undefined ? (en.substring(0, 100) + '...') : 'undefined'}`);
    
    if (!key || (es === undefined && en === undefined)) {
      return res.status(400).json({ error: 'key and at least one translation (es or en) is required' });
    }
    
    // Check if this is a title (titles should not be translated, use same value for both languages)
    const isTitle = key.endsWith('.title');
    
    if (isTitle) {
      // For titles, use the same value for both languages (no translation)
      if (es !== undefined && en === undefined) {
        en = es; // Use ES value for EN
        console.log('📝 Title detected: Using same value for both ES and EN (no translation)');
      } else if (en !== undefined && es === undefined) {
        es = en; // Use EN value for ES
        console.log('📝 Title detected: Using same value for both ES and EN (no translation)');
      }
    } else {
      // Auto-translate if only one language is provided (for non-title fields)
      if (es !== undefined && en === undefined && ollama) {
        console.log('🔄 Auto-translating ES to EN using Ollama...');
        try {
          en = await translateText(es, 'es', 'en');
          console.log(`✅ Auto-translated to EN: ${en.substring(0, 100)}...`);
        } catch (error) {
          console.warn('⚠️ Auto-translation failed, continuing with ES only:', error.message);
        }
      } else if (en !== undefined && es === undefined && ollama) {
        console.log('🔄 Auto-translating EN to ES using Ollama...');
        try {
          es = await translateText(en, 'en', 'es');
          console.log(`✅ Auto-translated to ES: ${es.substring(0, 100)}...`);
        } catch (error) {
          console.warn('⚠️ Auto-translation failed, continuing with EN only:', error.message);
        }
      } else if (!ollama && (es === undefined || en === undefined)) {
        console.warn('⚠️ Ollama not configured. Only provided language will be updated.');
      }
    }

    const translationsPath = path.join(__dirname, 'src', 'translations', 'index.ts');
    
    if (!fs.existsSync(translationsPath)) {
      return res.status(500).json({ error: 'Translations file not found' });
    }

    // Read and parse the translations file
    let content = fs.readFileSync(translationsPath, 'utf-8');
    
    // Extract the translations object from the file
    // Remove 'export const translations = ' and the final ';'
    const objectMatch = content.match(/export const translations = (\{[\s\S]*\});/);
    if (!objectMatch) {
      return res.status(500).json({ error: 'Could not parse translations file structure' });
    }
    
    // Parse the object as JavaScript
    let translations;
    try {
      // Use eval to parse the object (safe in this context as we control the file)
      translations = eval(`(${objectMatch[1]})`);
    } catch (error) {
      console.error('Error parsing translations object:', error);
      return res.status(500).json({ error: 'Failed to parse translations object' });
    }
    
    // Update the translations using dot notation
    if (es !== undefined) {
      const esPath = `es.${key}`;
      setNestedProperty(translations, esPath, es);
      console.log(`✅ Updated ES translation for ${key}`);
    }
    
    if (en !== undefined) {
      const enPath = `en.${key}`;
      setNestedProperty(translations, enPath, en);
      console.log(`✅ Updated EN translation for ${key}`);
    }
    
    // Format and write back to file
    const formattedObject = formatTranslationsObject(translations);
    const newContent = `export const translations = ${formattedObject};\n`;
    
    fs.writeFileSync(translationsPath, newContent, 'utf-8');
    
    console.log(`✅ Successfully updated translations file`);
    res.json({ success: true, message: 'Translation updated successfully' });
  } catch (error) {
    console.error('Error updating translation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get favorites
app.get('/api/favorites', (req, res) => {
  try {
    const statePath = path.join(__dirname, 'src', 'data', 'state.json');
    
    if (!fs.existsSync(statePath)) {
      return res.json({ favorites: [] });
    }
    
    let state = {};
    try {
      const content = fs.readFileSync(statePath, 'utf-8');
      state = JSON.parse(content);
    } catch (error) {
      console.warn('Error reading state.json for favorites:', error);
      return res.json({ favorites: [] });
    }
    
    const favorites = state.favorites || [];
    res.json({ favorites });
  } catch (error) {
    console.error('Error getting favorites:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle favorite (add if not present, remove if present)
app.put('/api/favorites/toggle', (req, res) => {
  try {
    const { imageSrc } = req.body;
    
    if (!imageSrc) {
      return res.status(400).json({ error: 'imageSrc is required' });
    }
    
    const statePath = path.join(__dirname, 'src', 'data', 'state.json');
    
    // Read existing state or create empty object
    let state = {};
    if (fs.existsSync(statePath)) {
      try {
        const content = fs.readFileSync(statePath, 'utf-8');
        state = JSON.parse(content);
      } catch (error) {
        console.warn('Error reading state.json for favorites toggle:', error);
        state = {};
      }
    }
    
    // Initialize favorites array if it doesn't exist
    if (!state.favorites) {
      state.favorites = [];
    }
    
    // Toggle favorite
    const index = state.favorites.indexOf(imageSrc);
    if (index === -1) {
      // Add to favorites
      state.favorites.push(imageSrc);
      console.log(`ToggleFavorite: Added ${imageSrc} to favorites`);
    } else {
      // Remove from favorites
      state.favorites.splice(index, 1);
      console.log(`ToggleFavorite: Removed ${imageSrc} from favorites`);
    }
    
    // Write back to file with pretty formatting
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    
    res.json({ success: true, favorites: state.favorites, isFavorite: index === -1 });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Upload server running on http://localhost:${PORT}`);
});

