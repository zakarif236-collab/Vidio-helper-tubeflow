import natural from 'natural';

// Types for structured output
export interface Chapter {
  timestamp: string;
  title: string;
}

export interface Summary {
  short: string;
  long: string;
}

export interface SEOMetadata {
  Title: string;
  Description: string;
  Keywords: string[];
}

export interface ContentProcessingResult {
  Transcript: string;
  Chapters: Chapter[];
  Summary: Summary;
  SEO: SEOMetadata;
  ThumbnailIdeas: string[];
  SocialCaptions: string[];
}

export interface IdeaDraftValidation {
  isValid: boolean;
  sentenceCount: number;
  issues: string[];
  sectionValidations: IdeaSectionValidation[];
}

export interface IdeaDraftSectionsInput {
  introduction?: string;
  development?: string;
  climax?: string;
  resolution?: string;
  targetMinutes?: number;
}

export interface IdeaSectionValidation {
  section: 'introduction' | 'development' | 'climax' | 'resolution';
  wordCount: number;
  minimumWords: number;
  isValid: boolean;
  issues: string[];
}

export interface IdeaImmersiveCue {
  section: 'introduction' | 'development' | 'climax' | 'resolution';
  visuals: string[];
  sounds: string[];
  emotionalBeat: string;
}

export interface IdeaTimelineItem {
  label: string;
  minutes: number;
  summary: string;
}

export interface IdeaDraftResult {
  draft: string;
  outline: string[];
  keywords: string[];
  validation: IdeaDraftValidation;
  source: 'local-nlp' | 'huggingface';
  sections: Required<IdeaDraftSectionsInput>;
  cues: IdeaImmersiveCue[];
  timeline: IdeaTimelineItem[];
}

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer();
const sentenceTokenizer = new natural.SentenceTokenizer();

/**
 * Extract keywords from text using natural.js
 * Filters for meaningful nouns and important words
 */
function extractKeywords(text: string, limit: number = 5): string[] {
  try {
    const words = tokenizer.tokenize(text.toLowerCase());
    
    // Filter stop words and short words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);

    const meaningfulWords = words.filter(
      word => word.length > 3 && !stopWords.has(word) && /^[a-z]+$/.test(word)
    );

    // Count word frequency
    const wordFreq: Record<string, number> = {};
    meaningfulWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    // Sort by frequency and return top keywords
    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([word]) => word);
  } catch (error) {
    console.error('Error extracting keywords:', error);
    return [];
  }
}

/**
 * Detect chapter boundaries based on topic shifts
 * Uses sentence analysis to find natural breaks
 */
function detectChapters(text: string, minChapters: number = 3): Chapter[] {
  try {
    const sentences = sentenceTokenizer.tokenize(text);
    const chapters: Chapter[] = [];
    
    // Approximate timing: assume 1 sentence = 3-5 seconds
    let currentTime = 0;
    let sentenceCount = 0;
    let chapterBuffer = '';
    const chapterSize = Math.max(Math.floor(sentences.length / minChapters), 5);

    sentences.forEach((sentence, idx) => {
      sentenceCount++;
      chapterBuffer += sentence + ' ';
      
      // Create chapters at natural breaks
      if (sentenceCount >= chapterSize || idx === sentences.length - 1) {
        const minutes = Math.floor(currentTime / 60);
        const seconds = currentTime % 60;
        const timestamp = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Generate chapter title from buffer
        const words = chapterBuffer.split(' ').slice(0, 5);
        const title = words.join(' ').substring(0, 40) + '...';
        
        chapters.push({ timestamp, title });
        currentTime += sentenceCount * 4; // Average 4 seconds per sentence
        sentenceCount = 0;
        chapterBuffer = '';
      }
    });

    return chapters.length > 0 
      ? chapters 
      : [{ timestamp: '00:00', title: 'Start' }];
  } catch (error) {
    console.error('Error detecting chapters:', error);
    return [{ timestamp: '00:00', title: 'Start' }];
  }
}

/**
 * Generate AI summary using text analysis
 * Extracts key sentences to create short and long summaries
 */
function generateSummary(text: string): Summary {
  try {
    const sentences = sentenceTokenizer.tokenize(text);
    
    // Generate short summary (1-2 sentences)
    const shortSummary = sentences.slice(0, 2).join(' ');
    
    // Generate long summary (3-5 sentences)
    const longSummary = sentences.slice(0, 5).join(' ');

    return {
      short: shortSummary,
      long: longSummary
    };
  } catch (error) {
    console.error('Error generating summary:', error);
    return {
      short: 'Unable to generate summary',
      long: 'Unable to generate detailed summary'
    };
  }
}

/**
 * Generate SEO metadata from text
 */
function generateSEOMetadata(text: string, subject: string): SEOMetadata {
  const keywords = extractKeywords(text, 6);
  const sentences = sentenceTokenizer.tokenize(text);
  
  return {
    Title: `${subject} - Complete Guide`,
    Description: sentences.slice(0, 2).join(' ').substring(0, 160),
    Keywords: keywords
  };
}

/**
 * Generate thumbnail concepts based on content
 */
function generateThumbnailConcepts(text: string, subject: string): string[] {
  const keywords = extractKeywords(text, 3);
  
  return [
    `Bold text "${subject}" with contrasting background colors`,
    `Visual representation of keywords: ${keywords.slice(0, 2).join(', ')}`,
    `High-contrast design with key statistics or numbers from content`,
  ];
}

/**
 * Generate social media captions
 */
function generateSocialCaptions(text: string, subject: string): string[] {
  const sentences = sentenceTokenizer.tokenize(text);
  const keywords = extractKeywords(text, 2);
  
  return [
    `Learn about ${subject}! ${sentences[0]} #${keywords[0]}`,
    `${subject} explained in under 5 minutes! Check out our latest video.`,
    `Key takeaway: ${sentences[1]} ${keywords.map(k => `#${k}`).join(' ')}`,
    `New video: ${subject}. Don't miss it! 🔥 ${keywords.map(k => `#${k}`).join(' ')}`,
  ];
}

const SECTION_MINIMUM_WORDS: Record<'introduction' | 'development' | 'climax' | 'resolution', number> = {
  introduction: 18,
  development: 32,
  climax: 24,
  resolution: 18,
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function validateSection(
  section: 'introduction' | 'development' | 'climax' | 'resolution',
  text: string
): IdeaSectionValidation {
  const wordCount = countWords(text);
  const minimumWords = SECTION_MINIMUM_WORDS[section];
  const issues: string[] = [];

  if (!text.trim()) {
    issues.push(`Add details for the ${section} section.`);
  }

  if (wordCount > 0 && wordCount < minimumWords) {
    issues.push(`Expand the ${section} section to at least ${minimumWords} words.`);
  }

  if (section === 'development' && !/[,.!?]/.test(text)) {
    issues.push('Break development into clear beats, dialogue, or story turns.');
  }

  return {
    section,
    wordCount,
    minimumWords,
    isValid: issues.length === 0,
    issues,
  };
}

function normalizeIdeaSections(
  idea: string,
  expandedText?: string,
  sectionInput: IdeaDraftSectionsInput = {}
): Required<IdeaDraftSectionsInput> {
  const foundationText = (expandedText && expandedText.trim()) || idea.trim();
  const foundationSentences = sentenceTokenizer.tokenize(foundationText).filter(Boolean);
  const summary = generateSummary(foundationText);
  const keywords = extractKeywords(`${idea} ${foundationText}`, 6);

  return {
    introduction: sectionInput.introduction?.trim() || foundationSentences[0] || `Open by framing ${idea.trim()} with a clear hook, the audience problem, and why this topic matters now.`,
    development: sectionInput.development?.trim() || foundationSentences.slice(1, 4).join(' ') || `${summary.long} Add examples, dialogue beats, and practical context around ${keywords.slice(0, 2).join(' and ') || 'the main topic'}.`,
    climax: sectionInput.climax?.trim() || foundationSentences[4] || `Reveal the turning point, strongest insight, or emotional peak that makes ${idea.trim()} memorable and worth finishing.`,
    resolution: sectionInput.resolution?.trim() || foundationSentences[5] || `Wrap up with the takeaway, next step, and a direct call to action tied to ${keywords[0] || 'the idea'}.`,
    targetMinutes: sectionInput.targetMinutes && sectionInput.targetMinutes > 0 ? sectionInput.targetMinutes : 15,
  };
}

function buildImmersiveCues(
  keywords: string[],
  sections: Required<IdeaDraftSectionsInput>
): IdeaImmersiveCue[] {
  const leadKeyword = keywords[0] || 'topic';
  const supportKeyword = keywords[1] || 'story';

  return [
    {
      section: 'introduction',
      visuals: [`Cold open close-up around ${leadKeyword}`, 'Fast title card reveal', 'Establishing B-roll that sets context'],
      sounds: ['Soft riser into the hook', 'Single impact hit on the main promise'],
      emotionalBeat: 'Curiosity and anticipation',
    },
    {
      section: 'development',
      visuals: [`Cutaways that explain ${supportKeyword}`, 'On-screen callouts for key beats', 'Alternating wide and medium shots to keep pacing alive'],
      sounds: ['Light rhythmic bed under explanation', 'Subtle transitions between beats'],
      emotionalBeat: 'Momentum and clarity',
    },
    {
      section: 'climax',
      visuals: ['Punch-in on the reveal moment', 'High-contrast visual cue or screen emphasis', 'Quick montage that heightens intensity'],
      sounds: ['Build-up swell into a stop', 'Accent hit on the turning point'],
      emotionalBeat: 'Intensity and payoff',
    },
    {
      section: 'resolution',
      visuals: ['Calmer framing for takeaway', 'Checklist or recap overlay', `End card tied to ${sections.targetMinutes}-minute format`],
      sounds: ['Music resolves and opens up', 'Gentle stinger under the call to action'],
      emotionalBeat: 'Closure and motivation',
    },
  ];
}

function buildTimeline(sections: Required<IdeaDraftSectionsInput>): IdeaTimelineItem[] {
  const totalMinutes = sections.targetMinutes || 15;
  const scaled = totalMinutes === 15
    ? [2, 3, 3, 4, 3]
    : [0.13, 0.2, 0.2, 0.27, 0.2].map((ratio) => Math.max(1, Math.round(totalMinutes * ratio)));

  return [
    { label: 'Intro', minutes: scaled[0], summary: sections.introduction },
    { label: 'Section 1', minutes: scaled[1], summary: sections.development },
    { label: 'Section 2', minutes: scaled[2], summary: sections.development },
    { label: 'Climax', minutes: scaled[3], summary: sections.climax },
    { label: 'Resolution', minutes: scaled[4], summary: sections.resolution },
  ];
}

export function validateIdea(idea: string, sections?: IdeaDraftSectionsInput): IdeaDraftValidation {
  const cleanedIdea = idea.trim();
  const sentences = sentenceTokenizer.tokenize(cleanedIdea);
  const issues: string[] = [];

  if (!cleanedIdea) {
    issues.push('Idea is required.');
  }

  if (sentences.length === 0) {
    issues.push('Write at least one complete sentence.');
  }

  if (sentences.length > 2) {
    issues.push('Keep the idea to 1 or 2 sentences for the best draft.');
  }

  if (cleanedIdea.split(/\s+/).length < 6) {
    issues.push('Add a little more detail so the script draft has enough context.');
  }

  const normalizedSections = normalizeIdeaSections(cleanedIdea || idea, undefined, sections);
  const sectionValidations = [
    validateSection('introduction', normalizedSections.introduction),
    validateSection('development', normalizedSections.development),
    validateSection('climax', normalizedSections.climax),
    validateSection('resolution', normalizedSections.resolution),
  ];

  sectionValidations.forEach((sectionValidation) => {
    issues.push(...sectionValidation.issues);
  });

  return {
    isValid: issues.length === 0,
    sentenceCount: sentences.length,
    issues,
    sectionValidations,
  };
}

export function buildIdeaScriptDraft(
  idea: string,
  sectionInput?: IdeaDraftSectionsInput,
  expandedText?: string,
  source: IdeaDraftResult['source'] = 'local-nlp'
): IdeaDraftResult {
  const sections = normalizeIdeaSections(idea, expandedText, sectionInput);
  const validation = validateIdea(idea, sections);
  const keywords = extractKeywords(`${idea} ${sections.introduction} ${sections.development} ${sections.climax} ${sections.resolution}`, 6);
  const titleSeed = keywords[0] || 'idea';
  const angleSeed = keywords[1] || 'workflow';
  const payoffSeed = keywords[2] || 'results';
  const cues = buildImmersiveCues(keywords, sections);
  const timeline = buildTimeline(sections);

  const outline = [
    `Hook the viewer with the core promise around ${titleSeed}.`,
    `Set up the problem or context using ${angleSeed}.`,
    `Deliver 2-3 concrete talking points tied to ${payoffSeed}.`,
    'Land the climax with a decisive reveal or emotional turn.',
    'Close with a simple takeaway and call to action.',
  ];

  const draft = [
    '[HOOK]',
    `Open with the strongest promise in the introduction: ${sections.introduction}`,
    '',
    '[INTRO]',
    `${sections.introduction}`,
    '',
    `[IMMERSIVE CUES: ${cues[0].section.toUpperCase()}]`,
    `Visuals: ${cues[0].visuals.join(' | ')}`,
    `Sound: ${cues[0].sounds.join(' | ')}`,
    `Emotion: ${cues[0].emotionalBeat}`,
    '',
    '[SECTION 1]',
    `${sections.development}`,
    '',
    '[SECTION 2]',
    `Add another beat that deepens the development. Bring in dialogue, conflict, or supporting detail tied to ${payoffSeed}.`,
    '',
    `[IMMERSIVE CUES: ${cues[1].section.toUpperCase()}]`,
    `Visuals: ${cues[1].visuals.join(' | ')}`,
    `Sound: ${cues[1].sounds.join(' | ')}`,
    `Emotion: ${cues[1].emotionalBeat}`,
    '',
    '[CLIMAX]',
    `${sections.climax}`,
    '',
    `[IMMERSIVE CUES: ${cues[2].section.toUpperCase()}]`,
    `Visuals: ${cues[2].visuals.join(' | ')}`,
    `Sound: ${cues[2].sounds.join(' | ')}`,
    `Emotion: ${cues[2].emotionalBeat}`,
    '',
    '[OUTRO]',
    `${sections.resolution}`,
    '',
    `[IMMERSIVE CUES: ${cues[3].section.toUpperCase()}]`,
    `Visuals: ${cues[3].visuals.join(' | ')}`,
    `Sound: ${cues[3].sounds.join(' | ')}`,
    `Emotion: ${cues[3].emotionalBeat}`,
    '',
    '[15-MINUTE TIMELINE]'
    , ...timeline.map((item) => `${item.label} (${item.minutes} min): ${item.summary}`),
  ].join('\n');

  return {
    draft,
    outline,
    keywords,
    validation,
    source,
    sections,
    cues,
    timeline,
  };
}

/**
 * Main processing function for all three input types
 */
export function processContent(
  input: {
    type: 'youtube' | 'script' | 'idea';
    data: {
      transcript?: string;
      script?: string;
      subject?: string;
    };
  }
): ContentProcessingResult {
  let text = '';
  
  // Extract text based on input type
  if (input.type === 'youtube' && input.data.transcript) {
    text = input.data.transcript;
  } else if (input.type === 'script' && input.data.script) {
    text = input.data.script;
  } else if (input.type === 'idea' && input.data.subject && input.data.script) {
    text = input.data.script;
  } else {
    throw new Error('Invalid input data');
  }

  const subject = input.data.subject || 'Video Content';

  // Process content
  const chapters = detectChapters(text);
  const summary = generateSummary(text);
  const seo = generateSEOMetadata(text, subject);
  const thumbnailIdeas = generateThumbnailConcepts(text, subject);
  const socialCaptions = generateSocialCaptions(text, subject);

  return {
    Transcript: text,
    Chapters: chapters,
    Summary: summary,
    SEO: seo,
    ThumbnailIdeas: thumbnailIdeas,
    SocialCaptions: socialCaptions
  };
}

/**
 * Add timestamps to script to create transcript
 */
export function addTimestampsToScript(script: string): string {
  const sentences = sentenceTokenizer.tokenize(script);
  let currentTime = 0;
  let result = '';

  sentences.forEach(sentence => {
    const minutes = Math.floor(currentTime / 60);
    const seconds = currentTime % 60;
    const timestamp = `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`;
    
    result += `${timestamp} ${sentence} `;
    currentTime += Math.ceil(sentence.split(' ').length / 3); // Assume 3 words per second
  });

  return result.trim();
}
