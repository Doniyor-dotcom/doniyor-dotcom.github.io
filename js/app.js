/* ================================================================
   app.js – Al-Quran front-end application
   Views: home | chapter | search | bookmarks
   ================================================================ */
'use strict';

/* ── State ──────────────────────────────────────────────────────── */
const state = {
  chapters:       [],
  currentChapter: null,
  currentVerses:  [],
  pagination:     { current_page: 1, total_pages: 1 },

  /* audio */
  audioQueue:     [],   // array of { url, verseKey, chapterName, verseNum }
  audioIndex:     0,
  isPlaying:      false,

  /* view */
  view:           'home', // 'home' | 'chapter' | 'search' | 'bookmarks'
  searchQuery:    '',
  searchResults:  null,
  searchPage:     1,

  /* settings (persisted) */
  settings: {
    translation:         131,
    recitation:          7,
    fontSize:            'medium',
    showTransliteration: true,
    showTranslation:     true,
    autoPlay:            false,
    theme:               'light',
  },

  /* bookmarks: { [verseKey]: { chapterName, verseNum, arabic, translation } } */
  bookmarks: {},
};

/* ── Helpers ────────────────────────────────────────────────────── */
function saveSettings()  { localStorage.setItem('qSettings',  JSON.stringify(state.settings));  }
function saveBookmarks() { localStorage.setItem('qBookmarks', JSON.stringify(state.bookmarks)); }

function loadPersisted() {
  try {
    const s = localStorage.getItem('qSettings');
    if (s) {
      const parsed = JSON.parse(s);
      /* Validate each key against the expected types before merging */
      if (typeof parsed === 'object' && parsed !== null) {
        const allowed = {
          translation: 'number', recitation: 'number', fontSize: 'string',
          showTransliteration: 'boolean', showTranslation: 'boolean',
          autoPlay: 'boolean', theme: 'string',
        };
        for (const [key, type] of Object.entries(allowed)) {
          if (key in parsed && typeof parsed[key] === type) {
            state.settings[key] = parsed[key];
          }
        }
      }
    }
  } catch (_) { /* ignore malformed data */ }
  try {
    const b = localStorage.getItem('qBookmarks');
    if (b) {
      const parsed = JSON.parse(b);
      /* Ensure bookmarks is a plain object with string keys */
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        state.bookmarks = parsed;
      }
    }
  } catch (_) { /* ignore malformed data */ }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const sun  = document.getElementById('theme-icon-sun');
  const moon = document.getElementById('theme-icon-moon');
  if (theme === 'dark') { sun.style.display = 'none'; moon.style.display = ''; }
  else                  { sun.style.display = '';     moon.style.display = 'none'; }
}

function applyFontSize(size) {
  document.documentElement.dataset.fontSize = size;
}

function formatTime(sec) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function showToast(msg) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function showLoading()  { document.getElementById('loading-overlay').classList.remove('hidden'); }
function hideLoading()  { document.getElementById('loading-overlay').classList.add('hidden');    }

/* ── DOM shortcuts ──────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const mainContent  = () => document.getElementById('main-content');
const surahList    = () => document.getElementById('surah-list');
const audioEl      = () => document.getElementById('quran-audio');
const audioPlayer  = () => document.getElementById('audio-player');

/* ── Sidebar ────────────────────────────────────────────────────── */
function renderSidebar() {
  const list = surahList();
  list.innerHTML = '';
  const filter = (document.getElementById('surah-filter').value || '').toLowerCase();

  state.chapters
    .filter(ch => {
      if (!filter) return true;
      return (
        ch.name_simple.toLowerCase().includes(filter) ||
        (ch.translated_name?.name || '').toLowerCase().includes(filter) ||
        String(ch.id).includes(filter)
      );
    })
    .forEach(ch => {
      const li = document.createElement('li');
      li.className = 'surah-item';
      li.setAttribute('role', 'option');
      li.dataset.id = ch.id;
      if (state.currentChapter?.id === ch.id) li.classList.add('active');
      li.innerHTML = `
        <span class="surah-num">${ch.id}</span>
        <div class="surah-info">
          <div class="surah-name-en">${ch.name_simple}</div>
          <div class="surah-meta">
            <span>${ch.verses_count} verses</span>
            <span class="surah-badge ${ch.revelation_place === 'makkah' ? 'badge-makki' : 'badge-madani'}">
              ${ch.revelation_place === 'makkah' ? 'Makki' : 'Madani'}
            </span>
          </div>
        </div>
        <span class="surah-arabic" lang="ar">${ch.name_arabic}</span>`;
      li.addEventListener('click', () => navigateChapter(ch.id));
      list.appendChild(li);
    });
}

function highlightActiveSurah(id) {
  $$('.surah-item').forEach(el => el.classList.toggle('active', Number(el.dataset.id) === id));
}

/* ── Home view ───────────────────────────────────────────────── */
function renderHome() {
  state.view = 'home';
  state.currentChapter = null;
  highlightActiveSurah(-1);

  mainContent().innerHTML = `
    <div class="home-hero">
      <div class="hero-bismillah" lang="ar">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>
      <h1 class="hero-title">The Holy Quran</h1>
      <p class="hero-subtitle">Read, listen and reflect upon the words of Allah</p>
      <div class="hero-stats">
        <div class="hero-stat"><div class="hero-stat-num">114</div><div class="hero-stat-label">Surahs</div></div>
        <div class="hero-stat"><div class="hero-stat-num">30</div><div class="hero-stat-label">Juz</div></div>
        <div class="hero-stat"><div class="hero-stat-num">6,236</div><div class="hero-stat-label">Verses</div></div>
        <div class="hero-stat"><div class="hero-stat-num">77,430</div><div class="hero-stat-label">Words</div></div>
      </div>
    </div>
    <div id="chapter-grid" class="home-grid"></div>`;

  const grid = document.getElementById('chapter-grid');
  state.chapters.forEach(ch => {
    const card = document.createElement('div');
    card.className = 'chapter-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Surah ${ch.name_simple}`);
    card.innerHTML = `
      <div class="chapter-card-num">${ch.id}</div>
      <div class="chapter-card-info">
        <div class="chapter-card-name">${ch.name_simple}</div>
        <div class="chapter-card-trans">${ch.translated_name?.name || ''}</div>
        <div class="chapter-card-meta">
          <span>${ch.verses_count} verses</span>
          <span class="surah-badge ${ch.revelation_place === 'makkah' ? 'badge-makki' : 'badge-madani'}">
            ${ch.revelation_place === 'makkah' ? 'Makki' : 'Madani'}
          </span>
        </div>
      </div>
      <div class="chapter-card-arabic" lang="ar">${ch.name_arabic}</div>`;
    card.addEventListener('click', () => navigateChapter(ch.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') navigateChapter(ch.id); });
    grid.appendChild(card);
  });
}

/* ── Chapter view ──────────────────────────────────────────────── */
async function navigateChapter(id, page = 1) {
  window.location.hash = `#chapter/${id}` + (page > 1 ? `/page/${page}` : '');
}

async function renderChapter(id, page = 1) {
  state.view = 'chapter';
  showLoading();

  try {
    const chapter = state.chapters.find(c => c.id === id) || (await QuranAPI.getChapter(id)).chapter;
    state.currentChapter = chapter;
    highlightActiveSurah(id);

    const data = await QuranAPI.getVerses(id, {
      page,
      perPage:     50,
      translation: state.settings.translation,
      recitation:  state.settings.recitation,
    });

    state.currentVerses = data.verses;
    state.pagination    = data.pagination;

    const content = mainContent();
    content.innerHTML = '';

    /* Chapter header */
    const header = document.createElement('div');
    header.className = 'chapter-header';
    header.innerHTML = `
      <div class="chapter-header-top">
        <div class="chapter-header-left">
          <h1>${chapter.id}. ${chapter.name_simple}</h1>
          <div class="chapter-translated-name">${chapter.translated_name?.name || ''}</div>
          <div class="chapter-meta">
            <span class="chapter-meta-badge ${chapter.revelation_place === 'makkah' ? 'badge-makki' : 'badge-madani'}">
              ${chapter.revelation_place === 'makkah' ? 'Makki' : 'Madani'}
            </span>
            <span class="chapter-meta-badge" style="background:var(--bg3);color:var(--text3)">
              ${chapter.verses_count} verses
            </span>
            <span class="chapter-meta-badge" style="background:var(--bg3);color:var(--text3)">
              Pages ${chapter.pages?.[0]}–${chapter.pages?.[1]}
            </span>
          </div>
        </div>
        <div class="chapter-arabic-name" lang="ar">${chapter.name_arabic}</div>
      </div>
      <div class="chapter-header-actions">
        <button class="btn btn-primary" id="play-chapter-btn">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Play Chapter
        </button>
        <button class="btn btn-outline" id="bookmark-chapter-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          Add Bookmark
        </button>
      </div>`;

    /* Bismillah (not for Surah 9, and Surah 1 has it as first verse) */
    if (chapter.bismillah_pre) {
      const bism = document.createElement('div');
      bism.className = 'bismillah-display';
      bism.setAttribute('lang', 'ar');
      bism.textContent = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
      header.appendChild(bism);
    }

    content.appendChild(header);

    /* Verses */
    const container = document.createElement('div');
    container.className = 'verses-container';
    container.id = 'verses-container';

    data.verses.forEach(verse => {
      container.appendChild(buildVerseCard(verse, chapter));
    });

    content.appendChild(container);

    /* Pagination */
    if (data.pagination.total_pages > 1) {
      content.appendChild(buildPagination(data.pagination, id));
    }

    /* Build audio queue from verses that have audio */
    state.audioQueue = data.verses
      .filter(v => v.audio?.url)
      .map(v => ({
        url:         QuranAPI.audioUrl(v.audio.url),
        verseKey:    v.verse_key,
        chapterName: chapter.name_simple,
        verseNum:    v.verse_number,
      }));

    /* Play chapter button */
    document.getElementById('play-chapter-btn').addEventListener('click', () => {
      playChapterAudio(chapter);
    });

    /* Bookmark chapter */
    document.getElementById('bookmark-chapter-btn').addEventListener('click', () => {
      showToast(`Bookmarks are per-verse. Tap the bookmark icon on any verse.`);
    });

  } catch (err) {
    console.error(err);
    const errDiv = document.createElement('div');
    errDiv.className = 'error-state';
    errDiv.innerHTML = `<h3>Failed to load chapter</h3><p>${err.message}</p>`;
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-primary mt-4';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => navigateChapter(id));
    errDiv.appendChild(retryBtn);
    mainContent().innerHTML = '';
    mainContent().appendChild(errDiv);
  } finally {
    hideLoading();
    mainContent().scrollTop = 0;
    window.scrollTo(0, 0);
  }
}

/* ── Verse card builder ─────────────────────────────────────────── */
function buildVerseCard(verse, chapter) {
  const card = document.createElement('div');
  card.className = 'verse-card';
  card.id = `verse-${verse.verse_key.replace(':', '-')}`;
  card.dataset.verseKey = verse.verse_key;

  const isBookmarked = !!state.bookmarks[verse.verse_key];
  const audioUrl     = verse.audio?.url ? QuranAPI.audioUrl(verse.audio.url) : null;
  const fontSize     = state.settings.fontSize;
  const showTrans    = state.settings.showTranslation;
  const showTranslit = state.settings.showTransliteration;

  /* Build transliteration from word data */
  let transliteration = '';
  if (verse.words) {
    transliteration = verse.words
      .filter(w => w.char_type_name === 'word' && w.transliteration?.text)
      .map(w => w.transliteration.text)
      .join(' ');
  }

  /* Primary translation text */
  const translationText = verse.translations?.[0]?.text || '';

  /* Build Arabic text from Uthmani field or word concatenation */
  const arabicText = verse.text_uthmani ||
    (verse.words ? verse.words.filter(w => w.text).map(w => w.text).join(' ') : '');

  card.innerHTML = `
    <div class="verse-card-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="verse-number-badge">${verse.verse_number}</div>
        <span class="verse-key">${verse.verse_key}</span>
        ${verse.juz_number ? `<span class="juz-badge">Juz ${verse.juz_number}</span>` : ''}
      </div>
      <span class="verse-page-info">Page ${verse.page_number || ''}</span>
      <div class="verse-actions">
        ${audioUrl ? `
        <button class="verse-action-btn play-verse-btn" data-url="${audioUrl}"
          data-verse-key="${verse.verse_key}" data-chapter="${chapter?.name_simple || ''}"
          data-verse-num="${verse.verse_number}" aria-label="Play verse">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>` : ''}
        <button class="verse-action-btn bookmark-btn ${isBookmarked ? 'bookmarked' : ''}"
          data-verse-key="${verse.verse_key}" aria-label="Bookmark verse" aria-pressed="${isBookmarked}">
          <svg viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button class="verse-action-btn copy-btn" data-arabic="${encodeURIComponent(arabicText)}"
          data-translation="${encodeURIComponent(translationText)}" data-verse-key="${verse.verse_key}"
          aria-label="Copy verse">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="verse-card-body">
      <div class="verse-arabic" lang="ar" data-size="${fontSize}">${arabicText}</div>
      ${showTranslit && transliteration ? `<div class="verse-transliteration">${transliteration}</div>` : ''}
      ${showTrans && translationText ? `<div class="verse-translation">${translationText}</div>` : ''}
    </div>`;

  /* Verse action events */
  const playBtn = card.querySelector('.play-verse-btn');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      const idx = state.audioQueue.findIndex(q => q.verseKey === verse.verse_key);
      if (idx !== -1) {
        state.audioIndex = idx;
        playAudio(state.audioQueue[idx]);
      } else {
        playAudio({
          url:         audioUrl,
          verseKey:    verse.verse_key,
          chapterName: chapter?.name_simple || '',
          verseNum:    verse.verse_number,
        });
      }
    });
  }

  card.querySelector('.bookmark-btn').addEventListener('click', e => {
    toggleBookmark(verse.verse_key, {
      chapterName:  chapter?.name_simple || '',
      verseNum:     verse.verse_number,
      verseKey:     verse.verse_key,
      arabic:       arabicText,
      translation:  translationText,
      chapterId:    verse.chapter_id,
    });
    const btn = e.currentTarget;
    const isNowBookmarked = !!state.bookmarks[verse.verse_key];
    btn.classList.toggle('bookmarked', isNowBookmarked);
    btn.setAttribute('aria-pressed', String(isNowBookmarked));
    btn.querySelector('svg').setAttribute('fill', isNowBookmarked ? 'currentColor' : 'none');
  });

  card.querySelector('.copy-btn').addEventListener('click', e => {
    const btn = e.currentTarget;
    const arabic = decodeURIComponent(btn.dataset.arabic);
    const trans  = decodeURIComponent(btn.dataset.translation);
    const text   = `${arabic}\n\n${trans}\n\n(${btn.dataset.verseKey})`;
    navigator.clipboard?.writeText(text).then(() => showToast('Verse copied to clipboard'));
  });

  return card;
}

/* ── Pagination ─────────────────────────────────────────────────── */
function buildPagination(pagination, chapterId) {
  const { current_page, total_pages } = pagination;
  const wrap = document.createElement('div');
  wrap.className = 'pagination';

  const prev = document.createElement('button');
  prev.className = 'page-btn';
  prev.textContent = '← Prev';
  prev.disabled = current_page <= 1;
  prev.addEventListener('click', () => navigateChapter(chapterId, current_page - 1));
  wrap.appendChild(prev);

  /* Show a window of page buttons */
  const range = [];
  for (let p = Math.max(1, current_page - 2); p <= Math.min(total_pages, current_page + 2); p++) {
    range.push(p);
  }
  range.forEach(p => {
    const btn = document.createElement('button');
    btn.className = `page-btn${p === current_page ? ' active' : ''}`;
    btn.textContent = p;
    btn.addEventListener('click', () => navigateChapter(chapterId, p));
    wrap.appendChild(btn);
  });

  const next = document.createElement('button');
  next.className = 'page-btn';
  next.textContent = 'Next →';
  next.disabled = current_page >= total_pages;
  next.addEventListener('click', () => navigateChapter(chapterId, current_page + 1));
  wrap.appendChild(next);

  return wrap;
}

/* ── Search view ────────────────────────────────────────────────── */
async function renderSearch(query, page = 1) {
  if (!query.trim()) { renderHome(); return; }
  state.view        = 'search';
  state.searchQuery = query;
  state.searchPage  = page;
  showLoading();

  try {
    const data = await QuranAPI.search(query, page);
    state.searchResults = data.search;

    const { results = [], total_results = 0, total_pages = 1 } = data.search;
    const content = mainContent();
    content.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'search-header';
    header.innerHTML = `
      <h2>Results for <em>"${query}"</em></h2>
      <span class="search-total">${total_results.toLocaleString()} verse${total_results !== 1 ? 's' : ''} found</span>`;
    content.appendChild(header);

    if (results.length === 0) {
      content.innerHTML += `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <h3>No results found</h3>
          <p>Try different keywords or check your spelling.</p>
        </div>`;
      return;
    }

    results.forEach(verse => {
      const card = document.createElement('div');
      card.className = 'search-result';
      const arabic = verse.text_uthmani || verse.words?.map(w => w.text).join(' ') || '';
      const trans  = verse.translations?.[0]?.text || '';
      card.innerHTML = `
        <div class="search-result-key">${verse.verse_key} · ${getChapterName(verse.verse_key)}</div>
        <div class="search-result-arabic" lang="ar">${arabic}</div>
        <div class="search-result-trans">${highlightQuery(trans, query)}</div>`;
      card.addEventListener('click', () => {
        const [chId] = verse.verse_key.split(':').map(Number);
        window.location.hash = `#chapter/${chId}`;
        setTimeout(() => {
          const target = document.getElementById(`verse-${verse.verse_key.replace(':', '-')}`);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 800);
      });
      content.appendChild(card);
    });

    /* Search pagination */
    if (total_pages > 1) {
      const pag = document.createElement('div');
      pag.className = 'pagination';

      if (page > 1) {
        const p = document.createElement('button');
        p.className = 'page-btn';
        p.textContent = '← Prev';
        p.addEventListener('click', () => renderSearch(query, page - 1));
        pag.appendChild(p);
      }
      const span = document.createElement('span');
      span.className = 'pagination-info';
      span.textContent = `Page ${page} of ${total_pages}`;
      pag.appendChild(span);
      if (page < total_pages) {
        const n = document.createElement('button');
        n.className = 'page-btn';
        n.textContent = 'Next →';
        n.addEventListener('click', () => renderSearch(query, page + 1));
        pag.appendChild(n);
      }
      content.appendChild(pag);
    }

  } catch (err) {
    console.error(err);
    mainContent().innerHTML = `
      <div class="error-state">
        <h3>Search failed</h3>
        <p>${err.message}</p>
      </div>`;
  } finally {
    hideLoading();
    window.scrollTo(0, 0);
  }
}

function getChapterName(verseKey) {
  const id = Number(verseKey.split(':')[0]);
  return state.chapters.find(c => c.id === id)?.name_simple || `Surah ${id}`;
}

function highlightQuery(text, query) {
  if (!query || !text) return text || '';
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

/* ── Bookmarks view ─────────────────────────────────────────────── */
function renderBookmarks() {
  state.view = 'bookmarks';
  const content = mainContent();
  content.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'bookmarks-header';
  header.innerHTML = `
    <h2>Bookmarks</h2>
    <p>Your saved verses from the Quran</p>`;
  content.appendChild(header);

  const entries = Object.values(state.bookmarks);
  if (entries.length === 0) {
    content.innerHTML += `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        <h3>No bookmarks yet</h3>
        <p>Tap the bookmark icon on any verse to save it here.</p>
      </div>`;
    return;
  }

  const container = document.createElement('div');
  container.className = 'verses-container';
  entries.forEach(bm => {
    const card = document.createElement('div');
    card.className = 'search-result';
    card.style.position = 'relative';
    card.innerHTML = `
      <div class="search-result-key">
        ${bm.verseKey} · ${bm.chapterName}
        <button class="verse-action-btn bookmark-btn bookmarked" data-verse-key="${bm.verseKey}"
          style="position:absolute;top:12px;right:12px" aria-label="Remove bookmark">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
      <div class="search-result-arabic" lang="ar">${bm.arabic}</div>
      <div class="search-result-trans">${bm.translation}</div>`;

    card.querySelectorAll('.search-result-arabic, .search-result-trans').forEach(el => {
      el.addEventListener('click', () => {
        const [chId] = bm.verseKey.split(':').map(Number);
        window.location.hash = `#chapter/${chId}`;
      });
    });

    card.querySelector('.bookmark-btn').addEventListener('click', e => {
      toggleBookmark(bm.verseKey, bm);
      card.remove();
      if (!Object.keys(state.bookmarks).length) renderBookmarks();
    });

    container.appendChild(card);
  });
  content.appendChild(container);
}

/* ── Bookmark toggle ────────────────────────────────────────────── */
function toggleBookmark(verseKey, data) {
  if (state.bookmarks[verseKey]) {
    delete state.bookmarks[verseKey];
    showToast('Bookmark removed');
  } else {
    state.bookmarks[verseKey] = data;
    showToast('Verse bookmarked ✓');
  }
  saveBookmarks();
}

/* ── Audio ──────────────────────────────────────────────────────── */
function playAudio({ url, verseKey, chapterName, verseNum }) {
  const audio = audioEl();
  if (!url) { showToast('Audio not available for this verse'); return; }

  audio.pause();
  audio.src = url;
  audio.load();
  audio.play().catch(err => {
    console.error('Audio play failed:', err);
    showToast('Could not play audio. Check your connection.');
  });

  state.isPlaying = true;
  updatePlayerUI({ verseKey, chapterName, verseNum });
  audioPlayer().classList.remove('hidden');

  /* Highlight active verse */
  $$('.verse-card.playing').forEach(el => el.classList.remove('playing'));
  const active = document.getElementById(`verse-${verseKey.replace(':', '-')}`);
  if (active) {
    active.classList.add('playing');
    active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

async function playChapterAudio(chapter) {
  showLoading();
  try {
    const data = await QuranAPI.getChapterAudio(state.settings.recitation, chapter.id);
    const url  = data.audio_file?.audio_url;
    if (!url) throw new Error('Audio URL not found');
    const audio = audioEl();
    audio.pause();
    audio.src = url;
    audio.load();
    audio.play().catch(err => { console.error(err); showToast('Could not play audio.'); });
    state.isPlaying = true;
    updatePlayerUI({ verseKey: `${chapter.id}:full`, chapterName: chapter.name_simple, verseNum: 'Full Chapter' });
    audioPlayer().classList.remove('hidden');
  } catch (err) {
    console.error(err);
    showToast('Chapter audio not available. Try verse-by-verse play.');
  } finally {
    hideLoading();
  }
}

function updatePlayerUI({ verseKey, chapterName, verseNum }) {
  document.getElementById('player-chapter-name').textContent = chapterName || '';
  document.getElementById('player-verse-ref').textContent    = typeof verseNum === 'number'
    ? `Verse ${verseNum}` : (verseNum || verseKey);
  syncPlayPauseIcon(true);
}

function syncPlayPauseIcon(playing) {
  document.getElementById('play-icon').style.display  = playing ? 'none' : '';
  document.getElementById('pause-icon').style.display = playing ? ''     : 'none';
}

/* Wire up audio element events */
function initAudio() {
  const audio = audioEl();

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    document.getElementById('progress-bar-fill').style.width = pct + '%';
    document.getElementById('player-current-time').textContent = formatTime(audio.currentTime);
    document.getElementById('player-duration').textContent     = formatTime(audio.duration);
    document.getElementById('progress-bar-wrap').setAttribute('aria-valuenow', Math.round(pct));
  });

  audio.addEventListener('ended', () => {
    syncPlayPauseIcon(false);
    state.isPlaying = false;
    /* Repeat */
    if (document.getElementById('player-repeat').classList.contains('active')) {
      audio.play();
      state.isPlaying = true;
      syncPlayPauseIcon(true);
      return;
    }
    /* Auto-advance */
    if (state.settings.autoPlay && state.audioQueue.length > 0) {
      state.audioIndex = (state.audioIndex + 1) % state.audioQueue.length;
      playAudio(state.audioQueue[state.audioIndex]);
    }
  });

  audio.addEventListener('play',  () => { state.isPlaying = true;  syncPlayPauseIcon(true);  });
  audio.addEventListener('pause', () => { state.isPlaying = false; syncPlayPauseIcon(false); });
  audio.addEventListener('error', () => {
    syncPlayPauseIcon(false);
    state.isPlaying = false;
    showToast('Audio error. Try again.');
  });

  /* Play/Pause button */
  document.getElementById('player-play').addEventListener('click', () => {
    if (state.isPlaying) { audio.pause(); }
    else if (audio.src) { audio.play(); }
  });

  /* Prev/Next */
  document.getElementById('player-prev').addEventListener('click', () => {
    if (!state.audioQueue.length) return;
    state.audioIndex = Math.max(0, state.audioIndex - 1);
    playAudio(state.audioQueue[state.audioIndex]);
  });
  document.getElementById('player-next').addEventListener('click', () => {
    if (!state.audioQueue.length) return;
    state.audioIndex = Math.min(state.audioQueue.length - 1, state.audioIndex + 1);
    playAudio(state.audioQueue[state.audioIndex]);
  });

  /* Seek */
  document.getElementById('progress-bar-wrap').addEventListener('click', e => {
    if (!audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  });

  /* Volume */
  document.getElementById('volume-slider').addEventListener('input', e => {
    audio.volume = e.target.value;
  });

  /* Repeat */
  document.getElementById('player-repeat').addEventListener('click', e => {
    e.currentTarget.classList.toggle('active');
  });

  /* Close */
  document.getElementById('player-close').addEventListener('click', () => {
    audio.pause();
    audio.src = '';
    audioPlayer().classList.add('hidden');
    state.isPlaying = false;
    $$('.verse-card.playing').forEach(el => el.classList.remove('playing'));
  });
}

/* ── Settings ───────────────────────────────────────────────────── */
function openSettings() {
  const s = state.settings;
  document.getElementById('setting-translation').value        = s.translation;
  document.getElementById('setting-recitation').value         = s.recitation;
  document.getElementById('setting-font-size').value          = s.fontSize;
  document.getElementById('setting-transliteration').checked  = s.showTransliteration;
  document.getElementById('setting-translation-toggle').checked = s.showTranslation;
  document.getElementById('setting-autoplay').checked         = s.autoPlay;
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function saveAndApplySettings() {
  state.settings.translation        = Number(document.getElementById('setting-translation').value);
  state.settings.recitation         = Number(document.getElementById('setting-recitation').value);
  state.settings.fontSize           = document.getElementById('setting-font-size').value;
  state.settings.showTransliteration = document.getElementById('setting-transliteration').checked;
  state.settings.showTranslation    = document.getElementById('setting-translation-toggle').checked;
  state.settings.autoPlay           = document.getElementById('setting-autoplay').checked;

  saveSettings();
  applyFontSize(state.settings.fontSize);
  closeSettings();
  showToast('Settings saved ✓');

  /* Reload current view with new settings */
  if (state.view === 'chapter' && state.currentChapter) {
    renderChapter(state.currentChapter.id, state.pagination.current_page);
  }
}

/* ── Router ─────────────────────────────────────────────────────── */
function parseHash() {
  const hash = window.location.hash.replace('#', '') || 'home';
  if (hash === 'home')        return { view: 'home' };
  if (hash === 'bookmarks')   return { view: 'bookmarks' };

  const chapterMatch = hash.match(/^chapter\/(\d+)(?:\/page\/(\d+))?$/);
  if (chapterMatch) {
    return { view: 'chapter', id: Number(chapterMatch[1]), page: Number(chapterMatch[2] || 1) };
  }
  const searchMatch = hash.match(/^search\/(.+)$/);
  if (searchMatch) {
    return { view: 'search', query: decodeURIComponent(searchMatch[1]) };
  }
  return { view: 'home' };
}

function handleRoute() {
  const route = parseHash();
  switch (route.view) {
    case 'home':      renderHome();                         break;
    case 'chapter':   renderChapter(route.id, route.page); break;
    case 'search':    renderSearch(route.query);            break;
    case 'bookmarks': renderBookmarks();                    break;
    default:          renderHome();
  }
}

/* ── Sidebar toggle ─────────────────────────────────────────────── */
function initSidebarToggle() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const toggle   = document.getElementById('sidebar-toggle');
  const content  = mainContent();
  const isMobile = () => window.innerWidth <= 768;

  function open()  { sidebar.classList.add('open'); sidebar.classList.remove('collapsed'); overlay.classList.add('active'); }
  function close() { sidebar.classList.remove('open'); overlay.classList.remove('active'); }

  toggle.addEventListener('click', () => {
    if (isMobile()) {
      sidebar.classList.contains('open') ? close() : open();
    } else {
      sidebar.classList.toggle('collapsed');
      content.classList.toggle('full-width', sidebar.classList.contains('collapsed'));
    }
  });

  overlay.addEventListener('click', close);

  /* Close sidebar on surah select (mobile) */
  document.addEventListener('click', e => {
    if (isMobile() && e.target.closest('.surah-item')) close();
  });
}

/* ── Main init ──────────────────────────────────────────────────── */
async function init() {
  loadPersisted();
  applyTheme(state.settings.theme);
  applyFontSize(state.settings.fontSize);

  /* Load chapters */
  showLoading();
  try {
    const data = await QuranAPI.getChapters();
    state.chapters = data.chapters;
    renderSidebar();
  } catch (err) {
    console.error('Failed to load chapters:', err);
    showToast('Failed to load chapters. Check your internet connection.');
    /* Show a retry button in the sidebar */
    const li = document.createElement('li');
    li.style.cssText = 'padding:20px;text-align:center;color:var(--text3)';
    li.innerHTML = '<p>Could not load chapters.</p>';
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-primary mt-4';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => location.reload());
    li.appendChild(retryBtn);
    surahList().innerHTML = '';
    surahList().appendChild(li);
  } finally {
    hideLoading();
  }

  /* Sidebar filter */
  document.getElementById('surah-filter').addEventListener('input', renderSidebar);

  /* Bookmarks nav button */
  document.getElementById('bookmarks-nav-btn').addEventListener('click', () => {
    window.location.hash = '#bookmarks';
  });

  /* Settings */
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('settings-save').addEventListener('click', saveAndApplySettings);
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSettings();
  });

  /* Theme toggle */
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = state.settings.theme === 'light' ? 'dark' : 'light';
    state.settings.theme = next;
    applyTheme(next);
    saveSettings();
  });

  /* Search form */
  document.getElementById('search-form').addEventListener('submit', e => {
    e.preventDefault();
    const q = document.getElementById('search-input').value.trim();
    if (q) window.location.hash = `#search/${encodeURIComponent(q)}`;
  });

  /* Audio */
  initAudio();

  /* Sidebar toggle */
  initSidebarToggle();

  /* Hash-based routing */
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

/* Start the app when DOM is ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
