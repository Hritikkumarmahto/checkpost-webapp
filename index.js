import express from 'express';
import cors from 'cors';
import { fileRouter } from './routes/api.js';
import dotenv from 'dotenv';
// Load environment variables
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
// CORS configuration
app.use(cors({
    origin: "https://check-post-webapp-tzw3.vercel.app", // Frontend URL
    methods: ["GET", "POST"],
    credentials: true,
}));
app.use(express.json());
// API routes
app.use('/api', fileRouter);
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Google API Key status:', process.env.GOOGLE_API_KEY ? 'Present' : 'Missing');
});
