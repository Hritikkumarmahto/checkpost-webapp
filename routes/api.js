import express from 'express';
import multer from 'multer';
import { FileProcessor } from '../services/fileService.js';
const router = express.Router();
// Configure multer for file upload
const upload = multer({
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        cb(null, allowedTypes.includes(file.mimetype));
    }
});
// File analysis endpoint
router.post('/analyze', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }
        const fileProcessor = new FileProcessor();
        //const contentAnalyzer = new ContentAnalyzer();
        // Process file and get analysis
        const { text, analysis } = await fileProcessor.extractText(req.file.buffer, req.file.mimetype);
        // For PDFs, use the content analyzer
        // if (req.file.mimetype === 'application/pdf') {
        //   const [sentiment, suggestions] = await Promise.all([
        //     contentAnalyzer.analyzeSentiment(text),
        //     contentAnalyzer.generateSuggestions(text)
        //   ]);
        //   res.json({
        //     text,
        //     sentiment,
        //     suggestions
        //   });
        // } else {
        // For images, use the Gemini analysis
        res.json({
            text: analysis.description,
            sentiment: analysis.sentiment,
            suggestions: analysis.suggestions
        });
        // }
    }
    catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Analysis failed' });
    }
});
export const fileRouter = router;
