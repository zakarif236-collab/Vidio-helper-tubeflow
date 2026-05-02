# Tubeflow Feature Roadmap

This document tracks features that are already partially built, not ready for the current release, or planned for future releases.

## Product Direction

Tubeflow is evolving into an AI creator workspace for YouTube and TikTok creators.

The product goal is simple:

- turn one idea into a publish-ready content package
- reduce time spent on scripting, packaging, and thumbnail prep
- help creators publish faster with better consistency and stronger click potential

## Current Product Baseline

Based on the existing app, Tubeflow already has a strong foundation:

- Idea to Video workflow
- Auto Chapters
- AI Summary
- Highlight Finder
- Transcript generation
- SEO support
- Creator Lab for thumbnail and visual composition
- authentication and settings foundation

This roadmap focuses on closing the gap between useful tools and a complete creator workflow.

## Status Legend

- `Built`: Core functionality exists and needs polish, integration, or launch work.
- `Planned`: Feature is approved conceptually but still needs implementation.
- `Backlog`: Worth doing, but not actively scheduled yet.

---

## Feature Template

Use this template when adding new roadmap items.

<details>
<summary><strong>[Feature Name]</strong> - [Built | Planned | Backlog] [Status]</summary>

**Status:** [Built | Planned | Backlog] [In Progress | Ready for Build | Needs Scope | Blocked]

**Time Estimate:** [X days/weeks/months]

**Description:** Brief explanation of the feature and the user value it creates.

**Why it is not in v1:** Short explanation of why this is deferred.

**Current State:**

- What already exists?
- What still needs to be completed?

**Integration Steps:**

1. Step one
2. Step two
3. Step three

**Dependencies:**

- Related features, APIs, storage, UI systems, or workflows this depends on.

</details>

---

## Release View

### v1 Launch Focus

The immediate goal for v1 should be polish, packaging, and workflow clarity rather than adding too many new systems.

**Recommended v1 goals:**

- make generated outputs feel export-ready
- reduce user decisions through smart suggestions
- improve consistency across Studio and Creator Lab
- create a smoother end-to-end creator flow

### v1.1 Growth Release

After launch, the next release should focus on personalization and saved workflow state.

**Recommended v1.1 goals:**

- reusable creator preferences
- project history and recovery
- stronger template guidance
- better visual optimization for thumbnails

### v2 Expansion Direction

The longer-term opportunity is turning Tubeflow into a creator operating system with analytics, collaboration, and learning loops.

---

## Roadmap by Timeframe

### Target Now (Under 1 Month)

Quick wins and features that can be enabled or polished quickly.

<details>
<summary><strong>Export Presets</strong> - Planned</summary>

**Status:** Planned [Ready for Build]

**Time Estimate:** 1 to 2 weeks

**Description:** Let creators save and reuse export configurations for different publishing goals such as YouTube long-form, Shorts, TikTok, captions-only, SEO pack, or full creator bundle.

**Why it is not in v1:** The current product focuses on generation workflows first, but creators still need a faster handoff from output to publishing.

**Current State:**

- Tubeflow already generates multiple output types across script, chapters, SEO, summaries, and creator assets.
- Export is not yet organized into reusable destination-specific presets.

**Integration Steps:**

1. Define preset schema for content pack exports.
2. Add preset save and edit UI in the main studio flow.
3. Connect preset output mapping to generated assets.
4. Support one-click export for common creator workflows.

**Dependencies:**

- Studio result models
- Settings persistence
- User profile or project-level saved preferences

</details>

<details>
<summary><strong>Template Suggestions</strong> - Planned</summary>

**Status:** Planned [Ready for Build]

**Time Estimate:** 1 to 2 weeks

**Description:** Recommend script presets, style presets, and thumbnail templates based on the creator's topic, platform, and content goal.

**Why it is not in v1:** The app already offers multiple preset systems, but users still have to choose them manually instead of being guided to the best fit.

**Current State:**

- Script presets and style presets already exist in the studio.
- Thumbnail templates already exist in Creator Lab.
- There is no recommendation layer connecting user intent to the right preset.

**Integration Steps:**

1. Build a suggestion engine using prompt type, content niche, and target platform.
2. Show recommended presets before generation starts.
3. Let users accept, dismiss, or refine the recommendation.
4. Capture usage feedback to improve future suggestions.

**Dependencies:**

- Existing studio presets
- Creator Lab template catalog
- User preference tracking

</details>

<details>
<summary><strong>Creator Pack Export</strong> - Built</summary>

**Status:** Built [Needs Product Polish]

**Time Estimate:** 1 week

**Description:** Package all generated outputs into a single creator-ready export bundle including script, chapter markers, keywords, captions, SEO copy, and thumbnail direction.

**Why it is not in v1:** Core pieces exist, but the final packaging and delivery experience still feels fragmented.

**Current State:**

- Tubeflow already generates several components of a publishing workflow.
- Users still need a cleaner way to export everything in one structured download.

**Integration Steps:**

1. Define the creator pack structure.
2. Normalize output formatting across generation tools.
3. Add download actions and file naming conventions.
4. Validate export completeness before delivery.

**Dependencies:**

- Output formatting helpers
- Download pipeline
- Consistent metadata across tools

</details>

---

### Next Up (1 to 3 Months)

Features that strengthen differentiation and improve creator workflow quality.

<details>
<summary><strong>Emotion Addition Tool (Face Expression Enhancement)</strong> - Planned</summary>

**Status:** Planned [Needs Scope]

**Time Estimate:** 3 to 5 weeks

**Description:** Help creators improve thumbnail impact by suggesting stronger facial expression direction, emotion intensity, pose adjustments, and visual emphasis cues for attention-grabbing thumbnails.

**Why it is not in v1:** This adds a more advanced visual intelligence layer and needs careful UX design so it feels useful rather than gimmicky.

**Current State:**

- Creator Lab already supports thumbnail layout composition and template-based design.
- There is no dedicated emotion-aware guidance or enhancement workflow yet.

**Integration Steps:**

1. Define supported expression categories such as surprise, urgency, confusion, excitement, and authority.
2. Add prompt-assisted thumbnail coaching inside Creator Lab.
3. Provide visual suggestions for text, contrast, crop, and expression emphasis.
4. Optionally connect to image editing or AI-assisted enhancement later.

**Dependencies:**

- Creator Lab canvas tools
- Prompt interpretation layer
- Future image analysis or enhancement services if automation is added

</details>

<details>
<summary><strong>Brand Kits and Creator Profiles</strong> - Planned</summary>

**Status:** Planned [Ready for Build]

**Time Estimate:** 2 to 4 weeks

**Description:** Let users save brand voice, default colors, thumbnail style, CTA patterns, and content niche so outputs stay consistent across every workflow.

**Why it is not in v1:** The current release prioritizes general-purpose output generation over creator-specific personalization.

**Current State:**

- Some settings infrastructure already exists.
- Personalization is not yet deeply connected to script generation, SEO, or thumbnail design.

**Integration Steps:**

1. Add creator profile data model.
2. Expand settings UI for brand preferences.
3. Inject profile context into generation prompts.
4. Reuse saved style context across Studio and Creator Lab.

**Dependencies:**

- Settings storage
- Prompt builders
- Shared user metadata

</details>

<details>
<summary><strong>Workflow History and Project Versions</strong> - Planned</summary>

**Status:** Planned [Needs Design]

**Time Estimate:** 2 to 3 weeks

**Description:** Save project sessions so creators can revisit previous outputs, compare versions, and iterate instead of restarting from scratch.

**Why it is not in v1:** It requires consistent storage design across multiple tools and output types.

**Current State:**

- Generation is session-based.
- Persistent project history is not yet treated as a first-class feature.

**Integration Steps:**

1. Define project and version entities.
2. Persist generated outputs by project.
3. Add restore and duplicate actions.
4. Add version comparison for scripts and SEO outputs.

**Dependencies:**

- User storage model
- Output serialization
- Authentication-aware project ownership

</details>

---

### Later (3+ Months)

Longer-horizon features that can expand Tubeflow into a more complete creator operating system.

<details>
<summary><strong>Performance Feedback Loop</strong> - Backlog</summary>

**Status:** Backlog [Needs Validation]

**Time Estimate:** 1 to 2 months

**Description:** Connect publishing performance back into Tubeflow so future recommendations improve based on CTR, watch time, retention, and format performance.

**Why it is not in v1:** This depends on external platform integrations and a stronger analytics model than the current app needs for launch.

**Current State:**

- Tubeflow helps produce content assets.
- It does not yet learn from published content performance.

**Integration Steps:**

1. Define metrics worth tracking.
2. Add manual or API-based performance ingestion.
3. Connect performance signals to recommendations.
4. Surface optimization suggestions for future content.

**Dependencies:**

- Platform integrations
- Analytics storage
- Recommendation logic

</details>

<details>
<summary><strong>Collaboration Mode</strong> - Backlog</summary>

**Status:** Backlog [Needs Product Strategy]

**Time Estimate:** 1 to 2 months

**Description:** Enable creators, editors, and channel managers to work on the same content project with shared assets, comments, and approvals.

**Why it is not in v1:** Multi-user collaboration adds complexity across auth, permissions, storage, and editing workflows.

**Current State:**

- The app is structured around a single-user workflow.
- Shared editing and role-based permissions do not yet exist.

**Integration Steps:**

1. Define collaborator roles.
2. Add shared project access.
3. Add comments and approval checkpoints.
4. Add project activity history.

**Dependencies:**

- Auth model
- Project storage
- Access control rules

</details>

---

## Suggested Priorities

If the goal is to strengthen v1 quickly, focus in this order:

1. Creator Pack Export
2. Export Presets
3. Template Suggestions
4. Brand Kits and Creator Profiles
5. Workflow History and Project Versions
6. Emotion Addition Tool

This order keeps the roadmap aligned with the current product: first complete the creator workflow, then improve personalization, then add more advanced intelligence.

---

## Roadmap Decision Filter

Use these questions before adding or promoting any future feature:

1. Does it save creators meaningful time?
2. Does it increase publishing quality or consistency?
3. Does it fit naturally into the existing Tubeflow workflow?
4. Can it be explained in one sentence on the homepage?
5. Will it help v1 feel more complete rather than more crowded?

If a feature fails most of these checks, it should stay in backlog until later.

---

## Recommended Next Build Sprint

If you want the cleanest next sprint for the app, build these three in sequence:

1. **Creator Pack Export** so users can leave with something usable
2. **Export Presets** so common creator workflows become one-click
3. **Template Suggestions** so the app feels smarter from the first interaction

That combination gives Tubeflow the biggest short-term product lift with relatively low complexity.