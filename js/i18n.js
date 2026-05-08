/**
 * i18n.js
 * Internationalization support (Japanese / English)
 */

const i18n = (() => {
  const dictionaries = {
    ja: {
      // HTML static
      'title': 'PDF Resize Tool',
      'subtitle': 'ブラウザで完結するPDF軽量化ツール',
      'drop.prompt': 'PDFファイルをドラッグ＆ドロップ',
      'drop.hint': 'または クリックして選択',
      'preset.label': '圧縮プリセット',
      'preset.light': '軽量',
      'preset.light.desc': '高品質・最小圧縮',
      'preset.standard': '標準',
      'preset.standard.desc': 'バランス重視',
      'preset.maximum': '最大圧縮',
      'preset.maximum.desc': 'サイズ優先',
      'settings.title': '詳細設定',
      'settings.jpegQuality': 'JPEG品質',
      'settings.maxDimension': '最大長辺 (px)',
      'settings.minPixelSize': '最小画像サイズ (px)',
      'settings.minPixelHint': '各辺がこれ未満の画像はスキップ',
      'settings.minByteSize': '最小データサイズ (KB)',
      'settings.transparency': '透過画像の処理',
      'settings.transparency.compress': '個別圧縮',
      'settings.transparency.flatten': '白背景で合成',
      'settings.transparency.skip': 'スキップ',
      'btn.compress': '圧縮開始',
      'progress.preparing': '準備中...',
      'result.originalSize': '元サイズ',
      'result.compressedSize': '圧縮後',
      'result.reductionRate': '削減率',
      'result.imageStats': '処理画像',
      'result.colorMode': 'カラーモード',
      'btn.download': 'ダウンロード',
      'footer.notice': 'Works offline — all processing runs locally in your browser.',
      'footer.github': 'View source on GitHub',

      // JS dynamic
      'alert.selectPdf': 'PDFファイルを選択してください。',
      'progress.reading': 'PDF を読み込み中...',
      'progress.analyzing': '画像を解析中...',
      'progress.image': '画像 {processed}/{total} 処理中... ({status}: {reason})',
      'stats.result': '{count}枚 (スキップ: {skipped}枚)',
      'error.prefix': 'エラー: {message}',

      // PDF processor reasons
      'reason.jbig2': 'デコード不可 (JBIG2/JPX)',
      'reason.cmyk': 'CMYK画像',
      'reason.indexed': 'パレット画像 (Indexed)',
      'reason.iccbased': 'ICCBased (安全のためスキップ)',
      'reason.unknownCS': '不明なColorSpace: {cs}',
      'reason.transparencySkip': '透過画像 (スキップ設定)',
      'reason.tooSmall': '小さい画像 ({w}x{h})',
      'reason.tooSmallData': 'データサイズ小 ({size}KB)',
      'reason.target': '圧縮対象',
      'reason.noGain': '圧縮効果なし ({pct}%)',
      'reason.compressed': '{before}KB → {after}KB',
      'colorMode.rgb': 'RGB',
      'colorMode.cmyk': 'CMYK',
      'colorMode.gray': 'グレー',
      'colorMode.indexed': 'Indexed',
      'colorMode.iccbased': 'ICCBased',
      'colorMode.unknown': '不明',
      'colorMode.mixed': '混在 ({modes})',
      'colorMode.undetectable': '判定不可',
    },
    en: {
      // HTML static
      'title': 'PDF Resize Tool',
      'subtitle': 'Browser-based PDF compression tool',
      'drop.prompt': 'Drag & drop a PDF file',
      'drop.hint': 'or click to select',
      'preset.label': 'Compression Preset',
      'preset.light': 'Light',
      'preset.light.desc': 'High quality',
      'preset.standard': 'Standard',
      'preset.standard.desc': 'Balanced',
      'preset.maximum': 'Maximum',
      'preset.maximum.desc': 'Smallest size',
      'settings.title': 'Advanced Settings',
      'settings.jpegQuality': 'JPEG Quality',
      'settings.maxDimension': 'Max Dimension (px)',
      'settings.minPixelSize': 'Min Image Size (px)',
      'settings.minPixelHint': 'Images smaller than this on each side are skipped',
      'settings.minByteSize': 'Min Data Size (KB)',
      'settings.transparency': 'Transparency Handling',
      'settings.transparency.compress': 'Compress individually',
      'settings.transparency.flatten': 'Flatten to white',
      'settings.transparency.skip': 'Skip',
      'btn.compress': 'Compress',
      'progress.preparing': 'Preparing...',
      'result.originalSize': 'Original',
      'result.compressedSize': 'Compressed',
      'result.reductionRate': 'Reduction',
      'result.imageStats': 'Images',
      'result.colorMode': 'Color Mode',
      'btn.download': 'Download',
      'footer.notice': 'Works offline — all processing runs locally in your browser.',
      'footer.github': 'View source on GitHub',

      // JS dynamic
      'alert.selectPdf': 'Please select a PDF file.',
      'progress.reading': 'Reading PDF...',
      'progress.analyzing': 'Analyzing images...',
      'progress.image': 'Processing image {processed}/{total}... ({status}: {reason})',
      'stats.result': '{count} processed ({skipped} skipped)',
      'error.prefix': 'Error: {message}',

      // PDF processor reasons
      'reason.jbig2': 'Cannot decode (JBIG2/JPX)',
      'reason.cmyk': 'CMYK image',
      'reason.indexed': 'Indexed/palette image',
      'reason.iccbased': 'ICCBased (skipped for safety)',
      'reason.unknownCS': 'Unknown ColorSpace: {cs}',
      'reason.transparencySkip': 'Transparent (skip mode)',
      'reason.tooSmall': 'Too small ({w}x{h})',
      'reason.tooSmallData': 'Data too small ({size}KB)',
      'reason.target': 'Will compress',
      'reason.noGain': 'No gain ({pct}%)',
      'reason.compressed': '{before}KB → {after}KB',
      'colorMode.rgb': 'RGB',
      'colorMode.cmyk': 'CMYK',
      'colorMode.gray': 'Gray',
      'colorMode.indexed': 'Indexed',
      'colorMode.iccbased': 'ICCBased',
      'colorMode.unknown': 'Unknown',
      'colorMode.mixed': 'Mixed ({modes})',
      'colorMode.undetectable': 'Undetectable',
    },
  };

  let currentLang = 'ja';

  /**
   * Look up a translation key, with optional {param} substitution.
   * Returns the key itself if not found (fallback).
   */
  function t(key, params) {
    const dict = dictionaries[currentLang] || dictionaries['ja'];
    let text = dict[key];
    if (text === undefined) {
      // Fallback to ja, then to key itself
      text = dictionaries['ja'][key];
      if (text === undefined) return key;
    }
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
      }
    }
    return text;
  }

  /**
   * Update all DOM elements with data-i18n attributes.
   */
  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translated = t(key);
      if (translated !== key) {
        el.textContent = translated;
      }
    });
    // Update html lang attribute
    document.documentElement.lang = currentLang;
    // Update active state of language toggle buttons
    document.querySelectorAll('.lang-toggle button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
  }

  /**
   * Switch language, save to localStorage, update all data-i18n elements.
   */
  function setLang(lang) {
    if (!dictionaries[lang]) return;
    currentLang = lang;
    try {
      localStorage.setItem('lang', lang);
    } catch (e) {
      // localStorage may be unavailable
    }
    applyTranslations();
  }

  /**
   * Get current language.
   */
  function getLang() {
    return currentLang;
  }

  /**
   * Detect language and apply translations.
   * Priority: localStorage > navigator.language > fallback 'ja'
   */
  function init() {
    let lang = null;
    try {
      lang = localStorage.getItem('lang');
    } catch (e) {
      // localStorage may be unavailable
    }
    if (!lang) {
      const navLang = (typeof navigator !== 'undefined' && navigator.language) || '';
      lang = navLang.startsWith('ja') ? 'ja' : 'en';
    }
    if (!dictionaries[lang]) {
      lang = 'ja';
    }
    currentLang = lang;
    applyTranslations();
  }

  return { t, setLang, getLang, init };
})();

// Auto-initialize when loaded
i18n.init();
