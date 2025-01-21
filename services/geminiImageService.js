import { GoogleGenerativeAI } from '@google/generative-ai';
export class GeminiImageService {
    constructor(apiKey) {
        this.MODEL_NAME = 'gemini-1.5-flash';
        const key = apiKey || process.env.GOOGLE_API_KEY;
        if (!key) {
            throw new Error('GOOGLE_API_KEY is required');
        }
        this.genAI = new GoogleGenerativeAI(key);
    }
    async getImageMimeType(buffer) {
        const header = buffer.toString('hex', 0, 4);
        if (header.startsWith('89504e47'))
            return 'image/png';
        if (header.startsWith('ffd8'))
            return 'image/jpeg';
        throw new Error('Unsupported image format. Only JPEG and PNG are supported.');
    }
    convertToBase64(buffer) {
        return buffer.toString('base64');
    }
    async analyzeImage(imageBuffer) {
        try {
            // Validate and get image mime type
            const mimeType = await this.getImageMimeType(imageBuffer);
            const base64Data = this.convertToBase64(imageBuffer);
            // Initialize the model
            const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });
            // Prepare the image part for the API
            const imagePart = {
                inlineData: {
                    data: base64Data,
                    mimeType
                }
            };
            // Prepare the prompt
            const promptPart = {
                text: `Analyze this image and provide a response in the following JSON format ONLY with detailed description in less than 100 words and very critically analysed suggestions (with every suggestion give example that suites the case) to enhance the post:
              {
                "description": "Brief description of the image content",
                "sentiment": {
                  "score": x,
                  "label": "positive|negative|neutral"
                },
                "suggestions": [
                  "suggestion1",
                  "suggestion2",
                  "suggestion3"
                ]
              }
              Ensure the sentiment score is between 0 and 100, where 100% is most positive,
              be very critical while giving sentimantal score(example - 23,47,96 etc).
              Provide ONLY the JSON response, no additional text.`
            };
            // Generate content
            const result = await model.generateContent([
                imagePart,
                promptPart
            ]);
            const response = await result.response;
            const text = response.text().trim();
            try {
                // Clean up the raw response text by removing markdown code block syntax
                const cleanText = text
                    .replace(/```json\n/g, '') // Remove opening JSON code block
                    .replace(/```/g, '') // Remove closing code block
                    .trim(); // Remove any extra whitespace
                // Attempt to parse the cleaned JSON
                const parsed = JSON.parse(cleanText);
                // Validate and normalize the response
                return {
                    description: typeof parsed.description === 'string'
                        ? parsed.description
                        : 'No description available',
                    sentiment: {
                        score: typeof parsed.sentiment?.score === 'number' &&
                            parsed.sentiment.score >= 0 &&
                            parsed.sentiment.score <= 100
                            ? parsed.sentiment.score
                            : 0.5,
                        label: ['positive', 'negative', 'neutral'].includes(parsed.sentiment?.label)
                            ? parsed.sentiment.label
                            : 'neutral'
                    },
                    suggestions: Array.isArray(parsed.suggestions)
                        ? parsed.suggestions.slice(0, 3).map(String)
                        : ['Add engaging visuals', 'Use relevant hashtags', 'Include a call-to-action']
                };
            }
            catch (parseError) {
                console.error('Failed to parse Gemini response as JSON:', {
                    error: parseError,
                    rawResponse: text
                });
                // Return fallback response
                return {
                    description: text.substring(0, 200) || 'Failed to analyze image',
                    sentiment: {
                        score: 59,
                        label: 'neutral'
                    },
                    suggestions: [
                        'Add engaging visuals',
                        'Use relevant hashtags',
                        'Include a call-to-action'
                    ]
                };
            }
        }
        catch (error) {
            console.error('Gemini analysis error:', error);
            throw new Error(error instanceof Error
                ? error.message
                : 'Failed to analyze image with Gemini');
        }
    }
}
