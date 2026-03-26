# Al-Quran – Read & Listen

A fully functional, modern Quran front-end website powered by the [Quran.com API v4](https://api.quran.com/api/v4).

## Features

- 📖 **Read all 114 Surahs** with Arabic (Uthmani) text
- 🔤 **Multiple translations** (Dr. Mustafa Khattab, Saheeh International, and more)
- 🎧 **Audio recitation** – verse-by-verse and full-chapter playback
- 🔍 **Full-text search** across translations
- 🔖 **Bookmarks** – save verses, persisted in localStorage
- 🌙 **Dark / Light mode** toggle
- 📱 **Fully responsive** – works on mobile, tablet, and desktop
- ⚙️ **Settings** – choose translation, reciter, Arabic font size, and display options
- ✍️ **Transliteration** – word-by-word romanised pronunciation

## Getting Started

No build step required — it's a pure static website.

### Run locally

1. Clone this repository
2. Open `index.html` in a modern browser, **or** serve it with any static file server:

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve .
```

3. Navigate to `http://localhost:8000`

> **Note:** The site makes requests to `https://api.quran.com` and audio CDN endpoints. An internet connection is required.

## Project Structure

```
quran/
├── index.html        # Main HTML shell
├── css/
│   └── style.css     # All styles (light/dark theme, responsive)
├── js/
│   ├── api.js        # Quran.com API v4 service with in-memory caching
│   └── app.js        # Application logic, router, state, event handlers
└── README.md
```

## API

Powered by the free [Quran.com API v4](https://api.quran.com/api/v4):

| Endpoint | Description |
|---|---|
| `GET /chapters` | List all 114 surahs |
| `GET /verses/by_chapter/{id}` | Paginated verses with Arabic text, translations & audio |
| `GET /chapter_recitations/{reciter}/{id}` | Full-chapter MP3 |
| `GET /search` | Full-text search across translations |

## Default Settings

| Setting | Default |
|---|---|
| Translation | Dr. Mustafa Khattab – The Clear Quran (id: 131) |
| Reciter | Mishari Rashid Alafasy (id: 7) |
| Arabic Font | Medium (2rem) |
| Theme | Light |