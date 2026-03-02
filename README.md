# Job Search Tracker

A lightweight web app that helps you:

- Pull jobs from your Google boolean search.
- Triage jobs quickly as **Applied** or **Not Interested**.
- Track outcomes across stages (1st/2nd/final rounds, offer, accepted, rejected).
- Capture notes for each application.
- Monitor funnel conversion metrics and average response timing.

## Run locally

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Notes on job pulling

The app attempts to fetch Google search content through a read-only proxy (`r.jina.ai`) to avoid browser CORS restrictions. If that fails, click **Open Search in New Tab** and keep using the tracker manually.

All data is stored in browser `localStorage`.
