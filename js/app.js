/**
 * app.js
 * UIロジック・ファイルI/O・プログレス表示
 */

(() => {
  // DOM要素
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const compressBtn = document.getElementById('compressBtn');
  const progressSection = document.getElementById('progressSection');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const resultSection = document.getElementById('resultSection');
  const originalSizeEl = document.getElementById('originalSize');
  const compressedSizeEl = document.getElementById('compressedSize');
  const reductionRateEl = document.getElementById('reductionRate');
  const imageStatsEl = document.getElementById('imageStats');
  const downloadBtn = document.getElementById('downloadBtn');
  const jpegQualityInput = document.getElementById('jpegQuality');
  const jpegQualityValue = document.getElementById('jpegQualityValue');

  let currentFile = null;
  let outputBlob = null;

  // --- ユーティリティ ---

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getSettings() {
    return {
      jpegQuality: parseFloat(jpegQualityInput.value),
      maxDimension: parseInt(document.getElementById('maxDimension').value, 10),
      minPixelThreshold: (() => {
        const px = parseInt(document.getElementById('minPixelSize').value, 10);
        return px * px; // 辺の長さ → ピクセル数
      })(),
      minByteThreshold: parseInt(document.getElementById('minByteSize').value, 10) * 1024,
      transparencyMode: document.querySelector('input[name="transparencyMode"]:checked').value,
      skipIfNoGain: 0.9,
    };
  }

  // --- ファイル入力 ---

  function handleFile(file) {
    if (!file || file.type !== 'application/pdf') {
      alert('PDFファイルを選択してください。');
      return;
    }

    currentFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatSize(file.size);
    fileInfo.hidden = false;
    dropZone.classList.add('has-file');
    compressBtn.disabled = false;

    // 前回の結果をリセット
    resultSection.hidden = true;
    progressSection.hidden = true;
    outputBlob = null;
  }

  // ドラッグ＆ドロップ
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    handleFile(file);
  });

  // クリック選択
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleFile(file);
  });

  // --- 設定 UI ---

  jpegQualityInput.addEventListener('input', () => {
    jpegQualityValue.textContent = `${Math.round(parseFloat(jpegQualityInput.value) * 100)}%`;
  });

  // --- 圧縮処理 ---

  compressBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    compressBtn.disabled = true;
    progressSection.hidden = false;
    resultSection.hidden = true;
    progressBar.style.width = '0%';
    progressText.textContent = 'PDF を読み込み中...';

    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      const settings = getSettings();

      progressText.textContent = '画像を解析中...';

      const { outputBytes, stats } = await PdfProcessor.processPdf(
        arrayBuffer,
        settings,
        (processed, total, info) => {
          const pct = Math.round((processed / total) * 100);
          progressBar.style.width = `${pct}%`;
          progressText.textContent = `画像 ${processed}/${total} 処理中... (${info.status}: ${info.reason})`;
        }
      );

      // 結果表示
      const originalBytes = currentFile.size;
      const compressedBytes = outputBytes.length;
      const reduction = ((1 - compressedBytes / originalBytes) * 100).toFixed(1);

      originalSizeEl.textContent = formatSize(originalBytes);
      compressedSizeEl.textContent = formatSize(compressedBytes);
      reductionRateEl.textContent = `${reduction}%`;
      reductionRateEl.style.color = reduction > 0 ? '#34c759' : '#ff3b30';
      imageStatsEl.textContent = `${stats.compressedCount}枚 (スキップ: ${stats.skippedCount}枚)`;

      outputBlob = new Blob([outputBytes], { type: 'application/pdf' });

      progressSection.hidden = true;
      resultSection.hidden = false;
    } catch (err) {
      console.error('PDF処理エラー:', err);
      progressText.textContent = `エラー: ${err.message}`;
    } finally {
      compressBtn.disabled = false;
    }
  });

  // --- ダウンロード ---

  downloadBtn.addEventListener('click', () => {
    if (!outputBlob) return;

    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement('a');
    a.href = url;

    // ファイル名に _compressed を付加
    const baseName = currentFile.name.replace(/\.pdf$/i, '');
    a.download = `${baseName}_compressed.pdf`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

})();
