# Reel Pipeline (prototype)

> **This is a prototype, not a finished product.** It shows how a talk → reviewed social-reel workflow could work at Yaqeen. The assignment asked for an idea and an optional prototype; this is that prototype, built at $0 in a few days.

**▶ [Watch the demo reel](https://youtube.com/shorts/xBa5XZlNe74)** · **📄 [Application write-up (PDF)](docs/Ahmed_Abdi_Yaqeen_Assignment.pdf)** · **👤 [CV (PDF)](docs/Ahmed_Abdi_CV.pdf)**

Built with Node.js, React/[Remotion](https://www.remotion.dev), Whisper (whisper.cpp), the Gemini API, yt-dlp and the Quran.com API.

## The problem

Every episode has several moments that would make a strong vertical clip. Cutting them by hand (finding the moment, typing captions, checking verses, designing cards) takes an editor hours, and a wrong verse or a careless depiction is not an option.

## What the prototype does

You give it a YouTube link. It produces a captioned, animated reel in the speaker's own voice, plus a one-page review sheet. **Nothing renders until a human approves.**

```
YouTube URL
  │ 1 Fetch        yt-dlp → original audio + title
  │ 2 Transcribe   Whisper (local)              ← AI: audio
  │ 3 Plan         Gemini picks moments          ← AI: language
  │ 4 Validate     code enforces the red lines   (errors go back to the AI once)
  │ 5 Review       review.md                     ← editor / scholar approves
  ▼ 6 Render       Remotion template → 1080×1920 MP4
```

Demo: Yaqeen's most-viewed video, the *The Name I Need* Ramadan 2026 trailer, turned into a [52-second reel](https://youtube.com/shorts/xBa5XZlNe74).

## Red lines, enforced in code

| Risk | Safeguard |
|---|---|
| Depicting Allah, prophets or any person | No image generation. The template renders only type, light and geometry. |
| AI inventing words | The AI picks transcript segment numbers only. Captions are the speaker's exact words. |
| Wrong Quran text | The AI gives a verse key. The text comes from the Quran.com API, and every verse is flagged for review. |
| Wrong Names of Allah | Only names from the fixed list `names.json`. Anything else is rejected. |
| Synthetic media | Original audio only. No added music, no cloned voice. The end card says it is an AI-assisted cut. |
| Unreviewed publishing | `render.mjs` refuses until a reviewer approves. It also re-checks verse and Name text against the sources, so edits made after review can't slip through. |

Full list: [pipeline/red-lines.md](pipeline/red-lines.md). The red lines and the render gate are covered by tests (`npm test`).

**Privacy:** the transcript of a *public* video is sent to the LLM provider (Gemini by default). For unreleased footage, switch to a local model (Ollama) in `.env` so nothing leaves the machine.

## Don't use AI here

- **Writing or paraphrasing religious content.** The speaker's words only.
- **Choosing which verse supports a point.** AI may suggest one; a scholar decides.
- **Generating faces, figures or historical scenes of the Prophet ﷺ, the companions, or any sacred figure.**
- **Voices.** No cloning or synthetic narration of scholars.
- **Final editorial judgment.** AI drafts the cut; an editor owns the story.

## Weak spots and how I'd fix them

Known gaps in this prototype (several raised in mock hiring-manager reviews), with the next step for each.

| Weak spot | Next step |
|---|---|
| **The story can jump.** Cuts can skip within the source (e.g. 25s → 36s), and a scene can start mid-sentence. | Reject or mark gaps over ~3s, and force scenes onto sentence boundaries. |
| **The verse can be only suggestive.** The 7:180 card sits over narration that doesn't quote it. | Show a verse card only when the speaker names or recites it (checked against the transcript), plus a second AI relevance check. A named scholar signs off, and every decision is logged. |
| **Review is a JSON flag.** Anyone can set it. (The verse text is now in the sheet, and sacred text is re-checked at render.) | A simple review page: preview, Arabic + translation, what the AI dropped, a checkbox per flag, and sign-off by role (editor + scholar). |
| **No editing-software integration** (a core duty). | Export captions and markers as SRT and Premiere XML / DaVinci Resolve EDL, so editors refine the cut in their own tools. First-month goal. |
| **Generative AI is thin** (audio + language only). | Run one small, red-line-reviewed visual experiment: abstract, non-figurative textures or backgrounds. Document where it should *not* be used. |
| **Captions are raw transcription.** He/Him for Allah needs a manual fix; Arabic quotes get garbled. | A multilingual Whisper model, a glossary of honorifics and terms, and an auto-fix pass the reviewer confirms. |
| **Narrow scope.** One video tested, six fixed scene types, tested on Windows only. | Run on 10+ episodes and on macOS, and add scene types designed with the animation team. |
| **Third-party data.** Quran.com API terms of use are not yet checked. | Confirm the licence, or use a vetted offline Quran text (e.g. Tanzil) with attribution. |
| **Unmeasured.** | See below. |

## Measuring success

Two questions: does the **tool** save work, and do the **reels** perform?

**The tool**
- **Editor time per reel:** a hand cut vs. the pipeline plus review, timed on the same episode. This is the headline number.
- **Cost per reel:** $0 on free tiers; API cost if you switch to paid models.
- **Accuracy:** reviewer edits per reel, errors caught before publishing, validator rejections.

**The reels**, per platform (YouTube Shorts, Instagram Reels, TikTok)
- **Average % watched and the 3-second hold rate:** content quality and the hook.
- **Shares and saves:** for faith content, the strongest signal.
- **Clicks to the full episode and new followers:** the real goal is to grow the long-form series.
- Views and likes are reported, not led with.

**How to make it fair:** compare at least 10 pipeline reels with 10 hand-made Yaqeen clips of the same length. Compare each platform against its own average. Use the free built-in analytics (YouTube Studio, Meta Business Suite, TikTok Studio), exported weekly to one sheet.

**Success means:** the same or better watch-through and shares than hand-made clips, at a fraction of the editor time.

## Run it

**Requirements:** Node.js 20.12+ and Python 3 with yt-dlp (`pip install yt-dlp`). The Whisper model (~150 MB) downloads on the first run.

**Setup:** run `npm install`, copy `.env.example` to `.env`, and paste a free Gemini key into it.

```powershell
npm run make -- "https://www.youtube.com/watch?v=VIDEO_ID"   # steps 1–5 (also accepts youtu.be and Shorts links)
npm run studio                                              # preview (run make first: it creates the audio file)
npm run render -- VIDEO_ID                                  # after approval
npm test                                                    # red-line and render-gate tests
```

Output goes to `out/VIDEO_ID/`: transcript, plan, storyboard, review sheet and reel. Each step is cached; delete `plan.json` to ask the AI for a new cut.

## Project files

| Path | What it is |
|---|---|
| `pipeline/run.mjs` | Steps 1–5: fetch, transcribe, plan, validate, write the review sheet |
| `pipeline/plan.mjs` | The only AI step (Gemini or any OpenAI-compatible model) |
| `pipeline/build.mjs` | Turns the plan into a storyboard and enforces the red lines |
| `pipeline/render.mjs` | Approval gate, then render |
| `pipeline/red-lines.md`, `names.json` | The rules, and the approved list of Names of Allah |
| `src/NameReel.tsx` | Remotion template: six scene types driven by one storyboard JSON |
| `docs/` | Application write-up and CV (PDF) |

## Media and rights

The source audio and the rendered reels belong to Yaqeen Institute. They are **not** stored in this repository (`out/` and `public/` are git-ignored). The demo reel was made only for this application and is not for republishing.
