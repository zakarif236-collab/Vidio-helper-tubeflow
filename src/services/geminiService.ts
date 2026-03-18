import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
});

export interface VideoAnalysis {
  summary: string;
  chapters: { timestamp: string; title: string }[];
  topics: string[];
  highlights: { timestamp: string; description: string }[];
  transcript: string;
  description: string;
  titles: string[];
  keywords: string[];
  socialCaptions: string[];
}

export async function analyzeYouTubeVideo(url: string, type?: 'audio' | 'video'): Promise<VideoAnalysis> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the YouTube video at this URL: ${url}.
    The user has selected to focus on the ${type || 'video'} content.
    Provide a comprehensive analysis in JSON format with the following structure:
    {
      "summary": "A clear explanation of the video content",
      "chapters": [{"timestamp": "MM:SS", "title": "Chapter Title"}],
      "topics": ["Topic 1", "Topic 2"],
      "highlights": [{"timestamp": "MM:SS", "description": "Highlight description"}],
      "transcript": "A brief simulated transcript or key dialogue points",
      "description": "An optimized YouTube description",
      "titles": ["Catchy Title 1", "Catchy Title 2"],
      "keywords": ["keyword1", "keyword2"],
      "socialCaptions": ["Twitter caption", "Instagram caption"]
    }
    If you cannot access the video directly, infer based on the URL and common knowledge if it's a popular video, otherwise provide a high-quality template analysis for a generic video of that type.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function analyzeUploadedVideo(fileData: string, mimeType: string): Promise<VideoAnalysis> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze this uploaded video file.
    Provide a comprehensive analysis in JSON format with the following structure:
    {
      "summary": "A clear explanation of the video content",
      "chapters": [{"timestamp": "MM:SS", "title": "Chapter Title"}],
      "topics": ["Topic 1", "Topic 2"],
      "highlights": [{"timestamp": "MM:SS", "description": "Highlight description"}],
      "transcript": "A full transcript of the dialogue",
      "description": "An optimized YouTube description",
      "titles": ["Catchy Title 1", "Catchy Title 2"],
      "keywords": ["keyword1", "keyword2"],
      "socialCaptions": ["Twitter caption", "Instagram caption"]
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: fileData.split(",")[1], // Remove prefix
              mimeType: mimeType,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function generateThumbnail(prompt: string): Promise<string> {
  const model = "gemini-2.5-flash-image";
  
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: `A high-quality YouTube thumbnail for a video about: ${prompt}. Vibrant colors, engaging composition, no text.` }] }],
  });

  let imageUrl = "";
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }
  
  return imageUrl;
}

export async function editThumbnail(base64Image: string, prompt: string): Promise<string> {
  const model = "gemini-2.5-flash-image";
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Image.split(",")[1],
              mimeType: "image/png",
            },
          },
          { text: `Edit this thumbnail based on this request: ${prompt}. Maintain the YouTube style, vibrant colors, and engaging composition.` },
        ],
      },
    ],
  });

  let imageUrl = "";
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }
  
  return imageUrl;
}
