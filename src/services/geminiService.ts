import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
});

export interface ProcessingResult {
  Transcript: string;
  Chapters: string[];
  Summary: string;
}

function normalizeBackendScriptResult(result: ComprehensiveResult): ProcessingResult {
  return {
    Transcript: result.Transcript || '',
    Chapters: Array.isArray(result.Chapters)
      ? result.Chapters.map((chapter) => `${chapter.timestamp} ${chapter.title}`)
      : [],
    Summary: typeof result.Summary === 'string'
      ? result.Summary
      : [result.Summary?.short, result.Summary?.long].filter(Boolean).join('\n\n'),
  };
}

export interface Chapter {
  timestamp: string;
  title: string;
}

export interface ComprehensiveResult {
  Transcript: string;
  Chapters: Chapter[];
  Summary: {
    short: string;
    long: string;
  };
  SEO: {
    Title: string;
    Description: string;
    Keywords: string[];
  };
  ThumbnailIdeas: string[];
  SocialCaptions: string[];
}

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

export interface IdeaDraftResponse {
  draft: string;
  outline: string[];
  keywords: string[];
  sections: {
    introduction: string;
    development: string;
    climax: string;
    resolution: string;
    targetMinutes: number;
  };
  cues: Array<{
    section: 'introduction' | 'development' | 'climax' | 'resolution';
    visuals: string[];
    sounds: string[];
    emotionalBeat: string;
  }>;
  timeline: Array<{
    label: string;
    minutes: number;
    summary: string;
  }>;
  validation: {
    isValid: boolean;
    sentenceCount: number;
    issues: string[];
    sectionValidations: Array<{
      section: 'introduction' | 'development' | 'climax' | 'resolution';
      wordCount: number;
      minimumWords: number;
      isValid: boolean;
      issues: string[];
    }>;
  };
  source: 'local-nlp' | 'huggingface' | 'gemini';
}

export interface IdeaDraftRequest {
  idea: string;
  sections?: {
    introduction?: string;
    development?: string;
    climax?: string;
    resolution?: string;
    targetMinutes?: number;
  };
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

// ========== New Backend-Based Processing Functions ==========

/**
 * Process YouTube transcript using backend NLP services
 * Returns comprehensive content package with chapters, SEO, thumbnails, and socials
 */
export async function processYouTubeTranscript(
  transcript: string,
  subject?: string
): Promise<ComprehensiveResult> {
  try {
    const response = await fetch('/api/process/youtube-transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, subject })
    });

    if (!response.ok) {
      throw new Error('Failed to process YouTube transcript');
    }

    return await response.json();
  } catch (error) {
    console.error('Error processing YouTube transcript:', error);
    throw error;
  }
}

/**
 * Process user-uploaded script using backend NLP services
 * Returns chapters, summary, SEO, and social captions
 */
export async function processUserScript(
  script: string,
  subject?: string
): Promise<ComprehensiveResult> {
  try {
    const response = await fetch('/api/process/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, subject })
    });

    if (!response.ok) {
      throw new Error('Failed to process script');
    }

    return await response.json();
  } catch (error) {
    console.error('Error processing script:', error);
    throw error;
  }
}

export async function generateIdeaDraft(payload: IdeaDraftRequest): Promise<IdeaDraftResponse> {
  const response = await fetch('/api/process/idea-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = 'Failed to generate idea draft';

    try {
      const errorBody = await response.json();
      if (typeof errorBody?.error === 'string' && errorBody.error.trim()) {
        message = errorBody.error;
      }
    } catch {
      // Ignore JSON parsing errors and keep the fallback message.
    }

    throw new Error(message);
  }

  return await response.json();
}

/**
 * Process subject idea into full video package
 * Requires AI-generated script as input
 * Returns: script + transcript + chapters + summary + SEO + thumbnails + socials
 */
export async function processIdeaToVideoPackage(
  subject: string,
  script: string
): Promise<ComprehensiveResult & { OriginalScript: string }> {
  try {
    const response = await fetch('/api/process/idea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, script })
    });

    if (!response.ok) {
      throw new Error('Failed to process idea into video package');
    }

    return await response.json();
  } catch (error) {
    console.error('Error processing idea:', error);
    throw error;
  }
}

// ========== Existing Gemini Service Functions ==========

/**
 * Unified function to process YouTube video URLs
 * Generates transcript, chapters, and summary for a YouTube URL
 */
export async function processYouTubeUrl(url: string): Promise<ProcessingResult> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the YouTube video at this URL: ${url}.
    
    Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
    {
      "Transcript": "Complete transcript of the video dialogue and narration. If you cannot access the video, create a realistic transcript based on what the video URL suggests.",
      "Chapters": ["00:00 Intro - introduction section", "02:15 Topic A - main discussion point one", "05:30 Topic B - main discussion point two", "08:45 Conclusion - wrapping up"],
      "Summary": "A concise 2-3 paragraph summary of the complete video content and main takeaways."
    }
    
    Ensure:
    - Transcript is detailed and realistic with timestamps
    - Chapters have format "MM:SS Chapter Title"
    - Summary is comprehensive but concise
    - All fields contain substantive content
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    const result = JSON.parse(response.text || "{}");
    return {
      Transcript: result.Transcript || "",
      Chapters: Array.isArray(result.Chapters) ? result.Chapters : [],
      Summary: result.Summary || ""
    };
  } catch (error) {
    console.error("Error parsing YouTube response:", error);
    return {
      Transcript: "",
      Chapters: [],
      Summary: ""
    };
  }
}

/**
 * Unified function to process user-uploaded scripts (text content)
 * Generates transcript, chapters, and summary for provided text/script content
 */
export async function processUploadedScript(scriptContent: string): Promise<ProcessingResult> {
  try {
    const model = "gemini-3-flash-preview";
    const prompt = `
      You have been provided with the following script/text content:
      
      "${scriptContent}"
      
      Analyze this content and return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
      {
        "Transcript": "A refined and properly formatted transcript of the script. Add timestamps every 30-60 seconds. Maintain the original dialogue and narration structure.",
        "Chapters": ["00:00 Section 1 Title", "02:30 Section 2 Title", "05:15 Section 3 Title", "08:00 Conclusion"],
        "Summary": "A comprehensive 2-3 paragraph summary of the script's main content, key ideas, and takeaways."
      }
      
      Ensure:
      - Transcript includes realistic timestamps at logical break points
      - Chapters have format "MM:SS Chapter Title" covering major sections
      - Summary accurately captures the essence of the content
      - All fields are substantive and well-written
    `;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text || "{}");
    const normalizedResult = {
      Transcript: result.Transcript || "",
      Chapters: Array.isArray(result.Chapters) ? result.Chapters : [],
      Summary: result.Summary || ""
    };

    if (!normalizedResult.Transcript && normalizedResult.Chapters.length === 0 && !normalizedResult.Summary) {
      throw new Error('Empty Gemini script response');
    }

    return normalizedResult;
  } catch (error) {
    console.warn('Falling back to backend script processor:', error);
    const backendResult = await processUserScript(scriptContent);
    return normalizeBackendScriptResult(backendResult);
  }
}

// ========== New "Idea to Full Video Package" Feature ==========

export interface FullVideoPackage {
  script: string;
  transcript: string;
  chapters: string[];
  summary: string;
  seoTitles: string[];
  seoDescription: string;
  keywords: string[];
  thumbnailConcepts: string[];
  socialCaptions: {
    instagram: string;
    tiktok: string;
    twitter: string;
    youtube: string;
  };
}

/**
 * Generates a structured video script from a subject idea
 * Allows user to edit before finalizing
 */
export async function generateScriptFromIdea(
  subject: string,
  tone: 'casual' | 'professional' | 'motivational'
): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  const toneDescription = {
    casual: "conversational, friendly, and engaging, as if talking to a friend",
    professional: "informative, structured, and authoritative, suitable for business or educational content",
    motivational: "inspiring, energetic, and uplifting, designed to motivate and engage the audience"
  };

  const prompt = `
    Create a complete video script for the topic: "${subject}"
    
    Tone: ${toneDescription[tone]}
    
    Structure the script with:
    - INTRO (30 seconds): Hook the audience, introduce the topic
    - SECTION 1 (45 seconds): First main point with details
    - SECTION 2 (45 seconds): Second main point with details
    - SECTION 3 (45 seconds): Third main point with details
    - CONCLUSION (30 seconds): Recap and call to action
    
    Return a naturally flowing, spoken-word script that is ready to record. 
    Include occasional natural pauses indicated by [...], and make it sound conversational.
    Total approximate duration: 3-4 minutes.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
  });

  return response.text || "Script generation failed. Please try again.";
}

/**
 * Generates complete video package from a finalized script
 * Produces transcript, chapters, summary, SEO, thumbnails, and social captions
 */
export async function generateFullVideoPackage(script: string): Promise<FullVideoPackage> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You have been provided with this video script:
    
    "${script}"
    
    Generate a COMPLETE video package in JSON format. Return ONLY valid JSON (no markdown) with this structure:
    {
      "transcript": "Convert the script to a properly formatted transcript with [MM:SS] timestamps. Add timestamps every 45-60 seconds.",
      "chapters": ["00:00 Intro - Hook and introduction", "01:15 Section 1 - First main topic", "02:45 Section 2 - Second main topic", "04:15 Section 3 - Third main topic", "05:45 Conclusion - Recap and CTA"],
      "summary": "Write a 3-4 paragraph comprehensive summary suitable for a YouTube video description.",
      "seoTitles": ["Title option 1 - Engaging and keyword-rich", "Title option 2 - Alternative angle", "Title option 3 - Question format"],
      "seoDescription": "Write a compelling 150-160 character YouTube video description that includes the main topic and encourages clicks.",
      "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
      "thumbnailConcepts": ["Concept 1: Bold text TOPIC with contrasting background colors", "Concept 2: Face reaction + Bold title text overlay", "Concept 3: Arrows pointing to key element with high contrast"],
      "socialCaptions": {
        "instagram": "Write an engaging Instagram caption with relevant hashtags (max 200 chars)",
        "tiktok": "Write a catchy TikTok caption with trendy hashtags (max 150 chars)",
        "twitter": "Write a tweet-style caption that's shareable (max 280 chars)",
        "youtube": "Write a YouTube community post or short caption (max 500 chars)"
      }
    }
    
    Ensure all content is:
    - Optimized for engagement and reach
    - Uses relevant keywords naturally
    - Maintains consistency with the script topic
    - Platform-appropriate for each social media
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    const result = JSON.parse(response.text || "{}");
    return {
      script: script,
      transcript: result.transcript || "",
      chapters: Array.isArray(result.chapters) ? result.chapters : [],
      summary: result.summary || "",
      seoTitles: Array.isArray(result.seoTitles) ? result.seoTitles : [],
      seoDescription: result.seoDescription || "",
      keywords: Array.isArray(result.keywords) ? result.keywords : [],
      thumbnailConcepts: Array.isArray(result.thumbnailConcepts) ? result.thumbnailConcepts : [],
      socialCaptions: {
        instagram: result.socialCaptions?.instagram || "",
        tiktok: result.socialCaptions?.tiktok || "",
        twitter: result.socialCaptions?.twitter || "",
        youtube: result.socialCaptions?.youtube || ""
      }
    };
  } catch (error) {
    console.error("Error parsing full video package:", error);
    return {
      script: script,
      transcript: "",
      chapters: [],
      summary: "",
      seoTitles: [],
      seoDescription: "",
      keywords: [],
      thumbnailConcepts: [],
      socialCaptions: {
        instagram: "",
        tiktok: "",
        twitter: "",
        youtube: ""
      }
    };
  }
}
