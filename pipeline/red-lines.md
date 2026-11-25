# Red lines

Non-negotiable rules. Each one names where it is enforced.

1. **No depiction of Allah, prophets, companions, angels, or any person or animal.**
   Enforced by design: the template has no image generation. It renders only typography, light and geometric patterns.
2. **The AI never writes on-screen words.**
   It only picks transcript segments. Every caption is the speaker's own words, word for word (`build.mjs`).
3. **Quran text is never typed by the AI.**
   The AI gives a verse key only. The Arabic and Saheeh International translation come from the Quran.com API, and every verse is flagged for scholar review.
4. **Names of Allah come only from the fixed list in `names.json`.**
   Any other name is rejected. Scholars extend the list, not the AI.
5. **No hadith, rulings or claims beyond what the speaker said.**
   No scene type exists for them.
6. **No added music, no synthetic or cloned voice.**
   Only the original audio of the source video is used.
7. **Sacred text is never distorted.**
   No glitch, shake or warp effects on Allah's name or Quran text (template rule).
8. **A human approves before anything is published.**
   `render.mjs` refuses until `review.approved` is `true` and a reviewer is named, and it re-checks verse and Name text against their sources.
9. **Disclose it.**
   The end card states it is an AI-assisted cut of the original video.
