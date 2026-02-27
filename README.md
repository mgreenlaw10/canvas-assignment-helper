# Canvas Helper

Chrome extension for `https://psu.instructure.com/*` that analyzes an assignment page and surfaces course files that appear relevant to the assignment.

## Files

- `manifest.json`: Manifest V3 configuration plus the background service worker.
- `content.js`: Detects Canvas assignment pages, triggers analysis, and renders an on-page widget with results.
- `background.js`: Loads the assignment PDF, scans the course `/files` page, reads supported files, and ranks likely matches.
- `popup.html`, `popup.css`, `popup.js`: Simple status popup.

## How It Works

1. On a URL matching `/courses/:courseId/assignments/:assignmentId`, the content script looks for a PDF link in the assignment content.
2. The background worker fetches that PDF (if found) and extracts basic text from it.
3. The worker loads `https://psu.instructure.com/courses/:courseId/files`, collects file links, and reads supported text files plus PDFs.
4. A built-in keyword-overlap analyzer ranks which files are likely relevant.
5. The content script shows a widget on the assignment page with links to the best matches.

## Current Limits

- PDF extraction is intentionally lightweight and only works reliably for PDFs whose text is directly embedded; scanned-image PDFs will need OCR or a full PDF parser.
- The analyzer currently uses a built-in heuristic, not an external LLM. The `rankRelevantFiles` step in `background.js` is the right place to swap in a real AI model later.
- Only text-like files and PDFs are read automatically. Binary formats such as `.docx` are skipped.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `c:\hackathon\canvas-helper`.
