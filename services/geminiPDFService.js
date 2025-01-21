import { GoogleGenerativeAI } from '@google/generative-ai';
import * as pdfjs from 'pdfjs-dist';
export class GeminiPDFService {
    constructor(apiKey) {
        this.MODEL_NAME = 'gemini-1.5-pro'; // Using pro model for text analysis
        const key = apiKey || process.env.GOOGLE_API_KEY;
        if (!key) {
            throw new Error('GOOGLE_API_KEY is required');
        }
        this.genAI = new GoogleGenerativeAI(key);
    }
    async extractTextFromPDF(buffer) {
        try {
            // Load the PDF document
            const data = new Uint8Array(buffer);
            const loadingTask = pdfjs.getDocument({ data });
            const pdf = await loadingTask.promise;
            // Extract text from all pages
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items
                    .map((item) => item.str)
                    .join(' ');
                fullText += pageText + '\n';
            }
            return fullText.trim();
        }
        catch (error) {
            console.error('PDF text extraction error:', error);
            throw new Error('Failed to extract text from PDF');
        }
    }
    async analyzePDF(pdfBuffer) {
        try {
            // Extract text from PDF
            const extractedText = await this.extractTextFromPDF(pdfBuffer);
            // Initialize the model
            const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });
            // Prepare the prompt
            const prompt = `Analyze this text as well as take the pdf as image because it sometimes pdf contains image too and provide a response in the following JSON format ONLY:
      {
        "text": "Full text extracted frommthe pdf in a formated manner",
        "summary": "A concise summary of the main points",
        "sentiment": {
          "score": X,
          "label": "positive|negative|neutral"
        },
        "suggestions": [
          "detailed suggestion with example 1",
          "detailed suggestion with example 2",
          "detailed suggestion with example 3"
        ]
      }
      Ensure the sentiment score is between 0 and 100%, where 100% is most positive.
      Provide ONLY the JSON response, no additional text.`;
            // Generate content
            const result = await model.generateContent([
                { text: extractedText },
                { text: prompt }
            ]);
            const response = await result.response;
            const text = response.text().trim();
            try {
                // Clean up the raw response text
                const cleanText = text
                    .replace(/```json\n/g, '')
                    .replace(/```/g, '')
                    .trim();
                // Parse and validate the response
                const parsed = JSON.parse(cleanText);
                return {
                    text: typeof parsed.text === 'string'
                        ? parsed.text
                        : extractedText.substring(0, 200),
                    summary: typeof parsed.summary === 'string'
                        ? parsed.summary
                        : 'No summary available',
                    sentiment: {
                        score: typeof parsed.sentiment?.score === 'number' &&
                            parsed.sentiment.score >= 0 &&
                            parsed.sentiment.score <= 100
                            ? parsed.sentiment.score
                            : 59,
                        label: ['positive', 'negative', 'neutral'].includes(parsed.sentiment?.label)
                            ? parsed.sentiment.label
                            : 'neutral'
                    },
                    suggestions: Array.isArray(parsed.suggestions)
                        ? parsed.suggestions.slice(0, 3).map(String)
                        : [
                            'Improve document structure',
                            'Add more concrete examples',
                            'Include clear conclusions'
                        ]
                };
            }
            catch (parseError) {
                console.error('Failed to parse Gemini response as JSON:', {
                    error: parseError,
                    rawResponse: text
                });
                // Return fallback response
                return {
                    text: extractedText.substring(0, 200),
                    summary: 'Failed to generate summary',
                    sentiment: {
                        score: 59,
                        label: 'neutral'
                    },
                    suggestions: [
                        'Improve document structure',
                        'Add more concrete examples',
                        'Include clear conclusions'
                    ]
                };
            }
        }
        catch (error) {
            console.error('PDF analysis error:', error);
            throw new Error(error instanceof Error
                ? error.message
                : 'Failed to analyze PDF with Gemini');
        }
    }
}
// import { GoogleGenerativeAI } from '@google/generative-ai';
// import { Buffer } from 'buffer';
// import * as pdfjs from 'pdfjs-dist';
// import sharp from 'sharp';
// interface PDFAnalysisResult {
//   text: string;
//   sentiment: {
//     score: number;
//     label: 'positive' | 'negative' | 'neutral';
//   };
//   suggestions: string[];
//   summary: string;
// }
// export class GeminiPDFService {
//   private genAI: GoogleGenerativeAI;
//   private readonly MODEL_NAME = 'gemini-1.5-pro-vision'; // Using vision model for image analysis
//   constructor(apiKey?: string) {
//     const key = apiKey || process.env.GOOGLE_API_KEY;
//     if (!key) {
//       throw new Error('GOOGLE_API_KEY is required');
//     }
//     this.genAI = new GoogleGenerativeAI(key);
//   }
//   private async convertPDFPageToImage(page: any): Promise<Buffer> {
//     try {
//       const viewport = page.getViewport({ scale: 1.5 }); // Increased scale for better quality
//       const canvas = new OffscreenCanvas(viewport.width, viewport.height);
//       const context = canvas.getContext('2d');
//       if (!context) {
//         throw new Error('Failed to get canvas context');
//       }
//       // Set canvas dimensions
//       canvas.width = viewport.width;
//       canvas.height = viewport.height;
//       // Render PDF page to canvas
//       const renderContext = {
//         canvasContext: context,
//         viewport: viewport,
//       };
//       await page.render(renderContext).promise;
//       // Convert canvas to blob
//       const blob = await canvas.convertToBlob({ type: 'image/png' });
//       const arrayBuffer = await blob.arrayBuffer();
//       // Optimize image using sharp
//       const optimizedBuffer = await sharp(Buffer.from(arrayBuffer))
//         .png({ quality: 80 })
//         .resize(2000, undefined, { // Max width 2000px, maintain aspect ratio
//           withoutEnlargement: true,
//           fit: 'inside'
//         })
//         .toBuffer();
//       return optimizedBuffer;
//     } catch (error) {
//       console.error('PDF to image conversion error:', error);
//       throw new Error('Failed to convert PDF page to image');
//     }
//   }
//   async analyzePDF(pdfBuffer: Buffer): Promise<PDFAnalysisResult> {
//     try {
//       // Load the PDF document
//       const data = new Uint8Array(pdfBuffer);
//       const loadingTask = pdfjs.getDocument({ data });
//       const pdf = await loadingTask.promise;
//       // Convert each page to an image
//       const pageImages: Buffer[] = [];
//       for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) { // Limit to first 5 pages
//         const page = await pdf.getPage(i);
//         const imageBuffer = await this.convertPDFPageToImage(page);
//         pageImages.push(imageBuffer);
//       }
//       // Initialize the vision model
//       const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });
//       // Prepare images for analysis
//       const imagesParts = await Promise.all(
//         pageImages.map(async (buffer) => ({
//           inlineData: {
//             data: buffer.toString('base64'),
//             mimeType: 'image/png'
//           }
//         }))
//       );
//       // Prepare the prompt
//       const prompt = `Analyze these PDF page images and provide a response in the following JSON format ONLY:
//       {
//         "text": "Detailed description of the visual content and any visible text",
//         "summary": "A concise summary of the main points and visual elements",
//         "sentiment": {
//           "score": X,
//           "label": "positive|negative|neutral"
//         },
//         "suggestions": [
//           "detailed suggestion with example 1",
//           "detailed suggestion with example 2",
//           "detailed suggestion with example 3"
//         ]
//       }
//       Consider both textual content and visual elements like layout, graphics, and formatting.
//       Ensure the sentiment score is between 0 and 100%, where 100% is most positive.
//       Provide ONLY the JSON response, no additional text.`;
//       // Generate content with all page images
//       const result = await model.generateContent([
//         ...imagesParts,
//         { text: prompt }
//       ]);
//       const response = await result.response;
//       const text = response.text().trim();
//       try {
//         // Clean up the raw response text
//         const cleanText = text
//           .replace(/```json\n/g, '')
//           .replace(/```/g, '')
//           .trim();
//         // Parse and validate the response
//         const parsed = JSON.parse(cleanText);
//         return {
//           text: typeof parsed.text === 'string'
//             ? parsed.text
//             : 'Failed to extract text from images',
//           summary: typeof parsed.summary === 'string'
//             ? parsed.summary
//             : 'No summary available',
//           sentiment: {
//             score: typeof parsed.sentiment?.score === 'number' &&
//               parsed.sentiment.score >= 0 &&
//               parsed.sentiment.score <= 100
//               ? parsed.sentiment.score
//               : 59,
//             label: ['positive', 'negative', 'neutral'].includes(parsed.sentiment?.label)
//               ? parsed.sentiment.label as 'positive' | 'negative' | 'neutral'
//               : 'neutral'
//           },
//           suggestions: Array.isArray(parsed.suggestions)
//             ? parsed.suggestions.slice(0, 3).map(String)
//             : [
//                 'Improve document layout and readability',
//                 'Enhance visual hierarchy',
//                 'Add more visual elements to support the content'
//               ]
//         };
//       } catch (parseError) {
//         console.error('Failed to parse Gemini response as JSON:', {
//           error: parseError,
//           rawResponse: text
//         });
//         // Return fallback response
//         return {
//           text: 'Failed to analyze PDF content',
//           summary: 'Failed to generate summary',
//           sentiment: {
//             score: 59,
//             label: 'neutral'
//           },
//           suggestions: [
//             'Improve document layout and readability',
//             'Enhance visual hierarchy',
//             'Add more visual elements to support the content'
//           ]
//         };
//       }
//     } catch (error) {
//       console.error('PDF analysis error:', error);
//       throw new Error(
//         error instanceof Error
//           ? error.message
//           : 'Failed to analyze PDF with Gemini'
//       );
//     }
//   }
// }
// import { GoogleGenerativeAI } from '@google/generative-ai';
// import { Buffer } from 'buffer';
// import * as pdfjs from 'pdfjs-dist';
// import { createCanvas } from 'canvas';
// import sharp from 'sharp';
// interface PDFAnalysisResult {
//   text: string;
//   sentiment: {
//     score: number;
//     label: 'positive' | 'negative' | 'neutral';
//   };
//   suggestions: string[];
//   summary: string;
// }
// export class GeminiPDFService {
//   private genAI: GoogleGenerativeAI;
//   private readonly MODEL_NAME = 'gemini-1.5-pro-vision';
//   constructor(apiKey?: string) {
//     const key = apiKey || process.env.GOOGLE_API_KEY;
//     if (!key) {
//       throw new Error('GOOGLE_API_KEY is required');
//     }
//     this.genAI = new GoogleGenerativeAI(key);
//   }
//   private async convertPDFPageToImage(page: any): Promise<Buffer> {
//     try {
//       const viewport = page.getViewport({ scale: 1.5 });
//       const canvas = createCanvas(viewport.width, viewport.height);
//       const context = canvas.getContext('2d');
//       // Set canvas dimensions
//       canvas.width = viewport.width;
//       canvas.height = viewport.height;
//       // Set white background
//       context.fillStyle = '#ffffff';
//       context.fillRect(0, 0, canvas.width, canvas.height);
//       // Render PDF page to canvas
//       const renderContext = {
//         canvasContext: context,
//         viewport: viewport,
//         background: 'white'
//       };
//       await page.render(renderContext).promise;
//       // Get canvas buffer directly
//       const buffer = canvas.toBuffer('image/png');
//       // Optimize image using sharp
//       const optimizedBuffer = await sharp(buffer)
//         .png({ quality: 80 })
//         .resize(2000, undefined, {
//           withoutEnlargement: true,
//           fit: 'inside'
//         })
//         .toBuffer();
//       return optimizedBuffer;
//     } catch (error) {
//       console.error('PDF to image conversion error:', error);
//       throw new Error('Failed to convert PDF page to image');
//     }
//   }
//   async analyzePDF(pdfBuffer: Buffer): Promise<PDFAnalysisResult> {
//     try {
//       // Load the PDF document
//       const data = new Uint8Array(pdfBuffer);
//       const loadingTask = pdfjs.getDocument({ data });
//       const pdf = await loadingTask.promise;
//       // Convert each page to an image
//       const pageImages: Buffer[] = [];
//       for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
//         const page = await pdf.getPage(i);
//         const imageBuffer = await this.convertPDFPageToImage(page);
//         pageImages.push(imageBuffer);
//       }
//       // Initialize the vision model
//       const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });
//       // Prepare images for analysis
//       const imagesParts = await Promise.all(
//         pageImages.map(async (buffer) => ({
//           inlineData: {
//             data: buffer.toString('base64'),
//             mimeType: 'image/png'
//           }
//         }))
//       );
//       // Prepare the prompt
//       const prompt = `Analyze these PDF page images and provide a response in the following JSON format ONLY:
//       {
//         "text": "Detailed description of the visual content and any visible text",
//         "summary": "A concise summary of the main points and visual elements",
//         "sentiment": {
//           "score": X,
//           "label": "positive|negative|neutral"
//         },
//         "suggestions": [
//           "detailed suggestion with example 1",
//           "detailed suggestion with example 2",
//           "detailed suggestion with example 3"
//         ]
//       }
//       Consider both textual content and visual elements like layout, graphics, and formatting.
//       Ensure the sentiment score is between 0 and 100%, where 100% is most positive.
//       Provide ONLY the JSON response, no additional text.`;
//       // Generate content with all page images
//       const result = await model.generateContent([
//         ...imagesParts,
//         { text: prompt }
//       ]);
//       const response = await result.response;
//       const text = response.text().trim();
//       try {
//         // Clean up the raw response text
//         const cleanText = text
//           .replace(/```json\n/g, '')
//           .replace(/```/g, '')
//           .trim();
//         // Parse and validate the response
//         const parsed = JSON.parse(cleanText);
//         return {
//           text: typeof parsed.text === 'string'
//             ? parsed.text
//             : 'Failed to extract text from images',
//           summary: typeof parsed.summary === 'string'
//             ? parsed.summary
//             : 'No summary available',
//           sentiment: {
//             score: typeof parsed.sentiment?.score === 'number' &&
//               parsed.sentiment.score >= 0 &&
//               parsed.sentiment.score <= 100
//               ? parsed.sentiment.score
//               : 59,
//             label: ['positive', 'negative', 'neutral'].includes(parsed.sentiment?.label)
//               ? parsed.sentiment.label as 'positive' | 'negative' | 'neutral'
//               : 'neutral'
//           },
//           suggestions: Array.isArray(parsed.suggestions)
//             ? parsed.suggestions.slice(0, 3).map(String)
//             : [
//                 'Improve document layout and readability',
//                 'Enhance visual hierarchy',
//                 'Add more visual elements to support the content'
//               ]
//         };
//       } catch (parseError) {
//         console.error('Failed to parse Gemini response as JSON:', {
//           error: parseError,
//           rawResponse: text
//         });
//         // Return fallback response
//         return {
//           text: 'Failed to analyze PDF content',
//           summary: 'Failed to generate summary',
//           sentiment: {
//             score: 59,
//             label: 'neutral'
//           },
//           suggestions: [
//             'Improve document layout and readability',
//             'Enhance visual hierarchy',
//             'Add more visual elements to support the content'
//           ]
//         };
//       }
//     } catch (error) {
//       console.error('PDF analysis error:', error);
//       throw new Error(
//         error instanceof Error
//           ? error.message
//           : 'Failed to analyze PDF with Gemini'
//       );
//     }
//   }
// }
