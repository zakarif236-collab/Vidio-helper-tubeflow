# 🧪 API Testing Guide - VideoHelper

## Quick API Testing Examples

Your backend is running on `http://localhost:3000`

---

## Test 1: Process YouTube Transcript

**Using cURL:**
```bash
curl -X POST http://localhost:3000/api/process/youtube-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Hello everyone. Today we are going to discuss the importance of deep work and focus. Deep work is the ability to concentrate without distraction on a cognitively demanding task. In our modern world with constant notifications and social media, deep work has become increasingly rare and valuable. Let me share three key strategies for achieving deep work.",
    "subject": "Deep Work Productivity Tips"
  }'
```

**Using VS Code REST Client** (install REST Client extension):

Create file `test.http`:
```http
POST http://localhost:3000/api/process/youtube-transcript
Content-Type: application/json

{
  "transcript": "Hello everyone. Today we are going to discuss the importance of deep work and focus. Deep work is the ability to concentrate without distraction on a cognitively demanding task. In our modern world with constant notifications and social media, deep work has become increasingly rare and valuable. Let me share three key strategies for achieving deep work.",
  "subject": "Deep Work Productivity Tips"
}
```

---

## Test 2: Process User Script

```bash
curl -X POST http://localhost:3000/api/process/script \
  -H "Content-Type: application/json" \
  -d '{
    "script": "Welcome to today'\''s episode. We'\''re discussing time management. Time management is not about doing more things. It'\''s about doing the right things. First strategy: prioritize tasks by impact. Second strategy: use time blocking. Third strategy: eliminate distractions.",
    "subject": "Time Management Masterclass"
  }'
```

---

## Test 3: Process Idea (Auto-Generate Script)

```bash
curl -X POST http://localhost:3000/api/process/idea \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "How to build a successful YouTube channel",
    "script": "[AI will generate if empty]"
  }'
```

---

## Expected Response Format

All endpoints return:

```json
{
  "Transcript": "[00:00] Full transcript with timestamps...",
  "Chapters": [
    {
      "timestamp": "00:00",
      "title": "Introduction and overview"
    },
    {
      "timestamp": "02:15",
      "title": "First main topic"
    }
  ],
  "Summary": {
    "short": "2-sentence summary.",
    "long": "5-sentence comprehensive summary."
  },
  "SEO": {
    "Title": "Main topic - Key benefit",
    "Description": "First 2-3 sentences optimized for SEO (150-160 chars).",
    "Keywords": ["keyword1", "keyword2", "keyword3"]
  },
  "ThumbnailIdeas": [
    "Visual concept 1 based on main keywords",
    "Visual concept 2 focusing on benefit",
    "Visual concept 3 with emotional hook"
  ],
  "SocialCaptions": {
    "Instagram": "Caption optimized for Instagram (~200 chars)",
    "TikTok": "Short, punchy caption for TikTok (~150 chars)",
    "Twitter": "Tweet-length caption (max 280 chars)",
    "YouTube": "Full YouTube caption (~500 chars)"
  }
}
```

---

## Testing from React Component

**Navigate to** `http://localhost:3000/studio`

1. Paste any transcript or script in the textarea
2. Click "Process Transcript" or "Process Script"
3. Observe results in real-time

**Or navigate to** `http://localhost:3000/idea-to-video`

1. Enter a video idea (e.g., "How to wake up early")
2. Select a tone (Casual/Professional/Motivational)
3. Click "Generate Script"
4. Review AI-generated script
5. Click "Generate Full Package"
6. See all outputs: chapters, summary, SEO, thumbnails, captions

---

## Response Examples

### Example 1: Transcript Output (Chapter Detection)
```
Input: "Hello everyone. Today we discuss productivity. Productivity is doing more with less. First strategy is time management. Second is task prioritization. Third is eliminating distractions. Thank you for watching."

Chapters Generated:
[
  {"timestamp": "00:00", "title": "Introduction to productivity"},
  {"timestamp": "00:08", "title": "Three productivity strategies"},
  {"timestamp": "00:20", "title": "Conclusion"}
]
```

### Example 2: Keywords Extracted
```
Input: "Learn machine learning techniques including neural networks, deep learning, data preprocessing..."

Keywords:
["machine learning", "neural networks", "deep learning", "data preprocessing"]
```

### Example 3: SEO Generated
```
Input: "Video about social media marketing"

SEO Output:
{
  "Title": "Master Social Media Marketing Strategy - 2024 Guide",
  "Description": "Learn proven social media marketing techniques to grow your audience and increase engagement. Expert strategies for all platforms.",
  "Keywords": ["social media", "marketing", "engagement", "strategy", "growth"]
}
```

---

## Real Example: Full Request-Response

**Request:**
```bash
curl -X POST http://localhost:3000/api/process/script \
  -H "Content-Type: application/json" \
  -d '{
    "script": "Hey everyone. Today we'\''re learning Python. Python is easy to learn. It has simple syntax. Perfect for beginners. We'\''ll cover variables, loops, and functions. By the end, you'\''ll write real programs. Thanks for watching.",
    "subject": "Learn Python"
  }'
```

**Response:**
```json
{
  "Transcript": "[00:00] Hey everyone. [00:05] Today we're learning Python. [00:10] Python is easy to learn. [00:15] It has simple syntax. [00:20] Perfect for beginners. [00:25] We'll cover variables, loops, and functions. [00:30] By the end, you'll write real programs. [00:35] Thanks for watching.",
  "Chapters": [
    {"timestamp": "00:00", "title": "Introduction to Python"},
    {"timestamp": "00:15", "title": "Why Python is beginner-friendly"},
    {"timestamp": "00:25", "title": "Core topics and skills"}
  ],
  "Summary": {
    "short": "Hey everyone. Today we're learning Python.",
    "long": "Hey everyone. Today we're learning Python. Python is easy to learn. It has simple syntax. Perfect for beginners."
  },
  "SEO": {
    "Title": "Learn Python - Complete Beginner Guide",
    "Description": "Master Python programming basics including variables, loops, and functions. Start writing real programs today.",
    "Keywords": ["python", "programming", "beginner", "variables", "coding"]
  },
  "ThumbnailIdeas": [
    "Bold text 'PYTHON BASICS' with code snippets on dark background",
    "Flowing stream of Python code with highlight on syntax",
    "Beginner-friendly arrow pointing to 'START HERE'"
  ],
  "SocialCaptions": {
    "Instagram": "🐍 Learn Python from zero! Simple syntax, easy logic, real programs. Perfect starter language. #Python #Coding #Programming",
    "TikTok": "Python is SO easy! 🐍 Master it in 60 seconds #Python #LearnToCode",
    "Twitter": "Start your coding journey with Python 🐍 Simple syntax, powerful capabilities. Perfect for beginners! #Python #Coding",
    "YouTube": "Complete Python tutorial for beginners. Learn variables, loops, functions, and write real programs. This video covers everything you need to start your coding journey."
  }
}
```

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 error | Ensure server running: `npm run dev` |
| `Cannot find module natural` | Run `npm install` |
| Port 3000 in use | Kill process: `lsof -ti:3000 \| xargs kill -9` |
| Empty response | Check JSON syntax, ensure fields are strings |

---

## Next Steps

1. ✅ Start dev server: `npm run dev`
2. ✅ Navigate to `http://localhost:3000/studio` or `/idea-to-video`
3. ✅ Test processing workflow
4. ✅ Check if output matches expected format
5. ✅ Verify all tabs display correctly

---

**All three processing paths are ready for testing! 🚀**

