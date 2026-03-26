/* ================================================================
   api.js – Quran.com API v4 service layer
   Docs: https://api.quran.com/api/v4
   ================================================================ */
'use strict';

const QuranAPI = (() => {
  const BASE      = 'https://api.quran.com/api/v4';
  const AUDIO_CDN = 'https://verses.quran.com/';

  /* In-memory cache to avoid duplicate requests */
  const _cache = new Map();

  async function _get(url) {
    if (_cache.has(url)) return _cache.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
    const json = await res.json();
    _cache.set(url, json);
    return json;
  }

  return {
    /**
     * Return all 114 chapters (surahs).
     * @param {string} language  – ISO 639-1 code, default 'en'
     */
    getChapters(language = 'en') {
      return _get(`${BASE}/chapters?language=${language}`);
    },

    /**
     * Return info for a single chapter.
     */
    getChapter(id, language = 'en') {
      return _get(`${BASE}/chapters/${id}?language=${language}`);
    },

    /**
     * Return paginated verses for a chapter.
     * @param {number} chapterId
     * @param {object} opts
     *   .page        {number}  default 1
     *   .perPage     {number}  default 50
     *   .translation {number}  resource id, default 131
     *   .recitation  {number}  recitation id for audio, default 7
     *   .language    {string}  default 'en'
     */
    getVerses(chapterId, opts = {}) {
      const {
        page        = 1,
        perPage     = 50,
        translation = 131,
        recitation  = 7,
        language    = 'en',
      } = opts;
      const fields = [
        'text_uthmani',
        'chapter_id',
        'hizb_number',
        'rub_el_hizb_number',
        'ruku_number',
        'manzil_number',
        'sajdah_number',
        'page_number',
        'juz_number',
      ].join(',');
      return _get(
        `${BASE}/verses/by_chapter/${chapterId}` +
        `?language=${language}` +
        `&words=true` +
        `&translations=${translation}` +
        `&audio=${recitation}` +
        `&per_page=${perPage}` +
        `&page=${page}` +
        `&fields=${fields}`,
      );
    },

    /**
     * Return full-chapter audio URL for a given reciter.
     */
    getChapterAudio(recitationId, chapterId) {
      return _get(`${BASE}/chapter_recitations/${recitationId}/${chapterId}`);
    },

    /**
     * List available reciters.
     */
    getRecitations() {
      return _get(`${BASE}/resources/recitations`);
    },

    /**
     * List available translations for a language.
     */
    getTranslations(language = 'en') {
      return _get(`${BASE}/resources/translations?language=${language}`);
    },

    /**
     * Full-text search.
     * @param {string} query
     * @param {number} page  1-based
     * @param {number} size  results per page
     */
    search(query, page = 1, size = 20) {
      return _get(
        `${BASE}/search?q=${encodeURIComponent(query)}&size=${size}&page=${page}`,
      );
    },

    /**
     * Build an absolute audio URL from a relative path returned by the API.
     * @param {string|null} path
     * @returns {string|null}
     */
    audioUrl(path) {
      if (!path) return null;
      return path.startsWith('http') ? path : `${AUDIO_CDN}${path}`;
    },
  };
})();
