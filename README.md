<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8429d703-e9e4-4950-91d5-8c6d129e6b58

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. For server-side account deletion and Firebase Auth disablement, configure Firebase Admin credentials with one of these options:
   `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service-account JSON file
   `FIREBASE_SERVICE_ACCOUNT_JSON` containing the full service-account JSON
   `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, and `FIREBASE_PROJECT_ID`
4. For authenticated AI generation, configure at least one server-side provider key:
   `GROQ_API_KEY` for Groq-backed drafts and thumbnail assistant requests
   `HUGGINGFACE_API_KEY` for Hugging Face idea-draft fallback and image generation
   `GEMINI_API_KEY` if you want the thumbnail assistant to use Gemini on the server when a user has not supplied their own key
5. Optional monthly quota controls:
   `TUBEFLOW_MONTHLY_IDEA_LIMIT` for `/api/process/idea-draft`
   `TUBEFLOW_MONTHLY_DRAFT_LIMIT` for `/api/youtube-to-script`, thumbnail assistant, and other server-backed AI draft endpoints
6. AI generation endpoints now require a signed-in Firebase user. The app tracks monthly usage counters in `users/{uid}.quota`.
7. Run the app:
   `npm run dev`
