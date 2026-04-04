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
  source: 'local-nlp' | 'huggingface' | 'gemini';
  sections: Required<IdeaDraftSectionsInput>;
  cues: IdeaImmersiveCue[];
  timeline: IdeaTimelineItem[];
}

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer();
const sentenceTokenizer = new natural.SentenceTokenizer();

type IdeaPhaseKey = 'introduction' | 'development' | 'climax' | 'resolution';

const IDEA_PHASE_HEADINGS = {
  introduction: 'Initial Concept',
  development: 'Develop Story',
  climax: 'Key Moment',
  resolution: 'Wrap Up',
} as const;

const IDEA_DURATION_OPTIONS = [8, 10, 15, 20] as const;
const IDEA_PHASE_RATIOS: Record<IdeaPhaseKey, number> = {
  introduction: 0.1,
  development: 0.35,
  climax: 0.35,
  resolution: 0.2,
};

const IDEA_WORD_TARGETS: Record<number, number> = {
  8: 1100,
  10: 1300,
  15: 1900,
  20: 2400,
};

function normalizeTargetMinutes(totalMinutes: number | undefined): 8 | 10 | 15 | 20 {
  if (typeof totalMinutes !== 'number' || !Number.isFinite(totalMinutes)) {
    return 15;
  }

  let bestMatch: 8 | 10 | 15 | 20 = 15;
  let bestDistance = Number.POSITIVE_INFINITY;

  IDEA_DURATION_OPTIONS.forEach((candidate) => {
    const distance = Math.abs(candidate - totalMinutes);
    if (distance < bestDistance) {
      bestMatch = candidate;
      bestDistance = distance;
    }
  });

  return bestMatch;
}

function getTargetWordCount(totalMinutes: number | undefined): number {
  return IDEA_WORD_TARGETS[normalizeTargetMinutes(totalMinutes)];
}

function buildPhaseMinutePlan(totalMinutes: number | undefined): Record<IdeaPhaseKey, number> {
  const normalizedMinutes = normalizeTargetMinutes(totalMinutes);
  const phases = (Object.keys(IDEA_PHASE_HEADINGS) as IdeaPhaseKey[]).map((phase) => ({
    phase,
    exact: normalizedMinutes * IDEA_PHASE_RATIOS[phase],
  }));

  const plan = Object.fromEntries(
    phases.map(({ phase, exact }) => [phase, Math.max(1, Math.floor(exact))])
  ) as Record<IdeaPhaseKey, number>;

  let assignedMinutes = Object.values(plan).reduce((sum, minutes) => sum + minutes, 0);
  const orderedByFraction = [...phases].sort((left, right) => {
    const leftFraction = left.exact - Math.floor(left.exact);
    const rightFraction = right.exact - Math.floor(right.exact);
    return rightFraction - leftFraction;
  });

  let cursor = 0;
  while (assignedMinutes < normalizedMinutes) {
    const phase = orderedByFraction[cursor % orderedByFraction.length].phase;
    plan[phase] += 1;
    assignedMinutes += 1;
    cursor += 1;
  }

  while (assignedMinutes > normalizedMinutes) {
    const phase = orderedByFraction[orderedByFraction.length - 1 - (cursor % orderedByFraction.length)].phase;
    if (plan[phase] > 1) {
      plan[phase] -= 1;
      assignedMinutes -= 1;
    }
    cursor += 1;
  }

  return plan;
}

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
    targetMinutes: normalizeTargetMinutes(sectionInput.targetMinutes),
  };
}

function parseGeneratedIdeaSections(script: string): Partial<Required<IdeaDraftSectionsInput>> {
  const normalizedScript = script.replace(/\r\n/g, '\n').trim();
  if (!normalizedScript) {
    return {};
  }

  const headings = [
    { key: 'introduction' as const, label: IDEA_PHASE_HEADINGS.introduction },
    { key: 'development' as const, label: IDEA_PHASE_HEADINGS.development },
    { key: 'climax' as const, label: IDEA_PHASE_HEADINGS.climax },
    { key: 'resolution' as const, label: IDEA_PHASE_HEADINGS.resolution },
  ];

  const positions = headings
    .map((heading) => {
      const pattern = new RegExp(`(?:^|\\n)\\s*${heading.label}\\s*:?[\\t ]*\\n?`, 'i');
      const match = pattern.exec(normalizedScript);
      return match ? { ...heading, index: match.index, matchLength: match[0].length } : null;
    })
    .filter(<T>(value: T): value is Exclude<T, null> => Boolean(value))
    .sort((a, b) => a.index - b.index);

  if (positions.length === 0) {
    return {};
  }

  const parsed: Partial<Required<IdeaDraftSectionsInput>> = {};
  for (let index = 0; index < positions.length; index += 1) {
    const current = positions[index];
    const next = positions[index + 1];
    const start = current.index + current.matchLength;
    const end = next ? next.index : normalizedScript.length;
    parsed[current.key] = normalizedScript.slice(start, end).trim();
  }

  return parsed;
}

function buildFallbackIdeaScript(
  idea: string,
  sections: Required<IdeaDraftSectionsInput>,
  keywords: string[]
): string {
  const targetMinutes = normalizeTargetMinutes(sections.targetMinutes);
  const topic = idea.trim();
  const mainKeyword = keywords[0] || 'this subject';
  const supportKeyword = keywords[1] || 'daily life';
  const thirdKeyword = keywords[2] || 'long-term consequences';
  const fourthKeyword = keywords[3] || 'better decisions';

  const introductionParagraphs = [
    `${sections.introduction} When most people hear a topic like ${topic}, they treat it as background noise. It sounds familiar. It sounds manageable. It sounds like something that belongs in a warning label, a headline, or a conversation that can wait until later. But that is exactly why it matters. The things that become dangerous are often the things we stop questioning. They blend into routine. They sit on the table, in the schedule, in the shopping cart, and in the habits people repeat without thinking too hard about what those habits are building over time.`,
    `So this is not just a script about fear. It is a script about awareness. It is about learning to see the gap between what looks normal and what actually costs us something. And once you start looking at ${mainKeyword} through that lens, the conversation changes. It is no longer only about taste, convenience, or short-term satisfaction. It becomes a question of tradeoffs. What are we accepting without noticing? What are we normalizing because everyone around us does the same thing? And how much damage can hide inside something that seems harmless when you only judge it one moment at a time?`,
    `That is why the opening matters so much. A good hook does not simply shock people. It helps them recognize themselves. It gives them a mirror. Maybe they see their own habits in it. Maybe they recognize the rhythm of their household, their lunch break, their late-night cravings, or their weekend routines. The moment they recognize themselves, the subject stops being somebody else's problem. It becomes immediate. It becomes personal. And when that happens, people are far more willing to listen to what comes next.`,
    `That is the hook for this story. We are going to move from the surface level into the deeper pattern. We will look at familiar examples, practical context, and the emotional shift that happens when a person realizes the issue is closer than they thought. By the end, the point is not just to understand the risk. The point is to leave with a clear way to think, choose, and respond differently.`,
  ];

  const introductionExtendedParagraphs = [
    `There is another reason this topic deserves time and clarity. People usually do not change because they were given one more fact. They change because a fact finally connects to their own life. That connection takes pacing. It takes examples. It takes a script that moves from recognition to understanding and then from understanding to action. So even in the opening, the goal is not simply to say that ${topic} can be dangerous. The goal is to help the listener feel why the topic belongs much closer to everyday decision-making than most people assume.`,
  ];

  const developmentParagraphs = [
    `${sections.development} Start with the most ordinary example. Picture someone moving through a busy day, skipping a real meal, grabbing whatever is fast, and telling themselves they will balance it out later. That choice does not feel dramatic. It feels efficient. It feels normal. Yet when that pattern repeats, the body starts paying for the convenience. Energy drops. Focus gets weaker. Mood shifts. Sleep becomes less consistent. And because the effect is gradual, people often blame stress, age, work, or bad luck before they ever look closely at what they are repeatedly consuming. The danger here is not always immediate shock. Sometimes the danger is that the damage arrives slowly enough to feel invisible.`,
    `Now take a second example inside a family setting. A parent is trying to save time, keep everyone fed, and avoid conflict. So the easy choice wins again and again. Highly processed meals, oversized portions, sugary snacks used as rewards, and drinks that feel harmless because they are marketed as part of a normal lifestyle. Listen to how that scene sounds in real life. "It is just for today." "They are kids, they will burn it off." "We will do better next week." Those lines are believable because they come from exhaustion, not malice. But that is exactly what makes the pattern powerful. Dangerous effects do not always come from reckless intent. They often come from tired people making repeat decisions in a system designed to make the least healthy option feel like the easiest one.`,
    `A third example shows up in the workplace. Think about someone who relies on quick comfort foods to get through deadlines, meetings, and long commutes. At first, the food feels like support. It gives a brief lift. It fills a gap. It offers a reward at the end of a draining stretch. But over time, the same routine begins to shape performance. Concentration becomes inconsistent. Crashes hit harder in the afternoon. Stress eating increases because pressure never really leaves the body, and the person starts chasing relief instead of nourishment. In that setting, the issue is no longer just personal preference. It becomes a cycle where pressure feeds poor choices and poor choices make pressure harder to handle.`,
    `There is also the social example, and this one is easy to miss because it hides inside celebration and belonging. People gather, order, snack, and overconsume because that is what the moment seems to invite. Nobody wants to be the difficult one. Nobody wants to interrupt the mood with questions about what is actually being eaten or how often this kind of excess has become normal. But social habits are powerful teachers. If every reward is edible, every gathering is built around overindulgence, and every emotional low point is answered with a quick hit of comfort, then the lesson becomes deeply ingrained: food is no longer nourishment first. It becomes a tool for mood control. And once that lesson settles in, it starts shaping behavior even when nobody else is in the room.`,
    `Then there is a fourth example, and this one matters because it introduces contrast. Imagine two people with similar schedules, similar budgets, and similar responsibilities. One keeps defaulting to whatever is fast and intensely rewarding in the moment. The other makes a few small but intentional adjustments. They read labels more often. They question portion sizes. They swap one harmful routine for one manageable alternative. They do not become perfect. They become aware. That difference sounds small, but it changes the direction of everything. The body responds to patterns. The mind responds to patterns. Health is rarely defined by one dramatic choice. It is shaped by repeated decisions that quietly build a future. That is where ${supportKeyword} connects to ${thirdKeyword}. The examples are different, but the pattern is the same.`,
    `And that practical context matters because people often think change only counts if it looks dramatic. It does not. In real life, better decisions usually look modest at first. Preparing one solid meal instead of skipping it. Drinking water before reaching for something sugary. Choosing to pause before eating out of stress rather than hunger. Reading one label with honest attention. Planning for the hard moment before the hard moment arrives. These are not glamorous actions. But they interrupt autopilot, and interrupting autopilot is one of the most powerful things a person can do when a dangerous pattern has started to feel normal.`,
  ];

  const developmentExtendedParagraphs = [
    `One more practical example helps make the pattern even clearer. Think about how marketing reshapes judgment. A label says natural. A package says high protein. An ad uses fitness imagery, family language, or emotional comfort. Suddenly a product feels safer than it really is because the story around it is more powerful than the substance inside it. That is part of the danger too. People are not only eating food. They are also consuming narratives about food, and those narratives can make harmful choices feel intelligent, modern, or earned when they are none of those things.`,
    `That is why a better approach is not just to react to cravings. It is to build a filter. Ask what the habit solves emotionally, what it costs physically, and what it trains mentally. Does it teach patience or dependence? Does it create stability or spikes and crashes? Does it help a person feel more in control, or does it quietly reduce their control over time? Questions like that slow the whole cycle down, and slowing the cycle down is often the first sign that a person is beginning to take ownership of it.`,
  ];

  const climaxParagraphs = [
    `${sections.climax} Here is the turning point. The strongest insight is that the danger is not only inside the food itself. The danger is also inside the relationship people build with it. Once food becomes comfort, distraction, reward, identity, and convenience all at once, it becomes very hard to judge clearly. A person stops asking, "Is this helping me?" and starts asking, "Will this get me through the next hour?" That shift is emotional as much as physical. It changes how people think, justify, and cope. And once the relationship becomes automatic, the consequences can keep growing long before the person decides they have a real problem.`,
    `This is the moment where the audience should feel the weight of the issue. Because now the subject is no longer abstract. It is not a lecture from a distance. It is personal. It is the child learning habits before they understand the cost. It is the adult treating exhaustion like a reason to surrender every standard. It is the person who feels fine enough to continue while the body quietly accumulates strain. And that is what gives the topic emotional impact. The most dangerous effects are often the ones that look survivable until they become normal, and then they become difficult to reverse because the behavior feels woven into daily life.`,
    `But this is also where the story becomes useful instead of hopeless. The reveal is not that people are doomed. The reveal is that awareness changes the script. The moment someone sees the pattern, they regain leverage. They can separate appetite from impulse. They can separate marketing from truth. They can separate what feels familiar from what is actually safe or sustainable. In other words, the key moment is not only a warning. It is a reset. It is the point where the listener realizes the real power is not in pretending danger does not exist. The real power is in recognizing it early enough to act on ${fourthKeyword}.`,
    `And if there is an emotional truth underneath all of this, it is that people often carry guilt without carrying clarity. They know something feels off, but they do not know how to name the pattern, so they blame themselves in vague and exhausting ways. That is why the strongest insight matters. It gives shape to the problem. It replaces shame with understanding. It says: this is not about one weak moment. This is about a system of repeated cues, repeated choices, repeated rewards, and repeated consequences. Once the listener understands that, the path forward becomes more realistic, because realistic change begins with accurate understanding, not just self-criticism.`,
  ];

  const climaxExtendedParagraphs = [
    `So the key moment is not only the realization that harm exists. It is the realization that harm compounds while it still feels manageable. That is the part people underestimate. The body can adapt for a while. The routine can appear sustainable for a while. The person can keep saying, "I am fine," for a while. But compounding does not need drama to be dangerous. It only needs repetition. And once the audience understands that, the subject stops sounding like a distant warning and starts sounding like a real decision point.`,
  ];

  const resolutionParagraphs = [
    `${sections.resolution} So the takeaway is clear. Do not judge food only by how fast it comforts you, how strongly it is advertised, or how normal it seems inside your environment. Judge it by the pattern it creates. Judge it by the energy it leaves behind. Judge it by the long-term story it is writing in your body and in your home. That is a stronger standard, and it leads to better decisions because it shifts attention from short-term craving to long-term consequence.`,
    `That also means the goal is not perfection. Perfection is usually too fragile to last. The real goal is attention. Notice what triggers the habit. Notice what keeps it in place. Notice what happens after the moment of convenience has passed. If a pattern leaves you feeling foggy, dependent, restless, or stuck, believe that information. Your body is part of the conversation, and it is often more honest than the story you tell yourself in the moment.`,
    `And here is the call to action. Choose one habit to examine honestly. Not ten. Not a dramatic reset. One habit. One drink, one snack, one rushed routine, one excuse you repeat so often it has started to sound reasonable. Look at it closely and ask a better question: what is this building in me over time? If the answer makes you uncomfortable, that is useful information. Change starts there. Awareness starts there. And if this message helped you see the subject differently, carry it forward. Share it, discuss it, and make one decision today that your future self will actually thank you for.`,
  ];

  const resolutionExtendedParagraphs = [
    `That is the most useful ending for a topic like this. Not panic. Not perfection. Direction. If the listener leaves with a clearer filter, a more honest question, and one practical change they can repeat, then the script has done its job. Awareness should become behavior, and behavior should become a better pattern. That is how a warning becomes something more valuable than fear. It becomes a tool for living with more intention.`,
  ];

  const selectedIntroductionParagraphs = targetMinutes === 8
    ? [introductionParagraphs[0], introductionParagraphs[3]]
    : targetMinutes === 10
    ? [introductionParagraphs[0], introductionParagraphs[1], introductionParagraphs[3]]
    : targetMinutes === 15
      ? introductionParagraphs
      : [...introductionParagraphs, ...introductionExtendedParagraphs];

  const selectedDevelopmentParagraphs = targetMinutes === 8
    ? [developmentParagraphs[0], developmentParagraphs[1], developmentParagraphs[5]]
    : targetMinutes === 10
    ? [developmentParagraphs[0], developmentParagraphs[1], developmentParagraphs[2], developmentParagraphs[5]]
    : targetMinutes === 15
      ? developmentParagraphs
      : [...developmentParagraphs, ...developmentExtendedParagraphs];

  const selectedClimaxParagraphs = targetMinutes === 8
    ? [climaxParagraphs[0], climaxParagraphs[2]]
    : targetMinutes === 10
    ? [climaxParagraphs[0], climaxParagraphs[1], climaxParagraphs[2]]
    : targetMinutes === 15
      ? climaxParagraphs
      : [...climaxParagraphs, ...climaxExtendedParagraphs];

  const selectedResolutionParagraphs = targetMinutes === 8
    ? [resolutionParagraphs[0]]
    : targetMinutes === 10
    ? [resolutionParagraphs[0], resolutionParagraphs[2]]
    : targetMinutes === 15
      ? resolutionParagraphs
      : [...resolutionParagraphs, ...resolutionExtendedParagraphs];

  return [
    IDEA_PHASE_HEADINGS.introduction,
    ...selectedIntroductionParagraphs,
    '',
    IDEA_PHASE_HEADINGS.development,
    ...selectedDevelopmentParagraphs,
    '',
    IDEA_PHASE_HEADINGS.climax,
    ...selectedClimaxParagraphs,
    '',
    IDEA_PHASE_HEADINGS.resolution,
    ...selectedResolutionParagraphs,
  ].join('\n\n');
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
  const phaseMinutes = buildPhaseMinutePlan(sections.targetMinutes);

  return [
    { label: IDEA_PHASE_HEADINGS.introduction, minutes: phaseMinutes.introduction, summary: sections.introduction },
    { label: IDEA_PHASE_HEADINGS.development, minutes: phaseMinutes.development, summary: sections.development },
    { label: IDEA_PHASE_HEADINGS.climax, minutes: phaseMinutes.climax, summary: sections.climax },
    { label: IDEA_PHASE_HEADINGS.resolution, minutes: phaseMinutes.resolution, summary: sections.resolution },
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
  const parsedSections = expandedText ? parseGeneratedIdeaSections(expandedText) : {};
  const sections = normalizeIdeaSections(idea, undefined, {
    ...parsedSections,
    ...sectionInput,
    targetMinutes: sectionInput?.targetMinutes,
  });
  const validation = validateIdea(idea, sections);
  const keywords = extractKeywords(`${idea} ${sections.introduction} ${sections.development} ${sections.climax} ${sections.resolution}`, 6);
  const cues = buildImmersiveCues(keywords, sections);
  const timeline = buildTimeline(sections);

  const outline = [
    `Open with an Initial Concept hook that explains why the topic matters now in about ${buildPhaseMinutePlan(sections.targetMinutes).introduction} minute${buildPhaseMinutePlan(sections.targetMinutes).introduction === 1 ? '' : 's'}.`,
    `Develop the story with concrete examples, case studies, and relatable scenarios across about ${buildPhaseMinutePlan(sections.targetMinutes).development} minutes.`,
    `Build to a Key Moment that reveals the strongest insight or turning point across about ${buildPhaseMinutePlan(sections.targetMinutes).climax} minutes.`,
    `Close with a Wrap Up that leaves one clear takeaway and a call to action across about ${buildPhaseMinutePlan(sections.targetMinutes).resolution} minutes.`,
  ];

  const draft = expandedText?.trim() || buildFallbackIdeaScript(idea, sections, keywords);

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
