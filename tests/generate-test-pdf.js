/**
 * テスト用PDFファイルを生成するスクリプト
 * テキスト + 大きなJPEG画像を含むPDFを作成
 *
 * 使い方: node tests/generate-test-pdf.js
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function generateTestPdf() {
  const pdfDoc = await PDFDocument.create();

  // フォント
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // --- ページ1: テキスト + 大きな画像 ---
  const page1 = pdfDoc.addPage([595, 842]); // A4
  page1.drawText('PDF Resize Tool - Test Document', {
    x: 50,
    y: 800,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });
  page1.drawText('This text should remain selectable after compression.', {
    x: 50,
    y: 770,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  page1.drawText('Page 1 of 2', {
    x: 50,
    y: 30,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // 大きなJPEG画像を生成（800x600のグラデーション）
  const jpegBytes = createLargeJpeg(800, 600);
  const jpegImage = await pdfDoc.embedJpg(jpegBytes);
  page1.drawImage(jpegImage, {
    x: 50,
    y: 200,
    width: 495,
    height: 371,
  });

  // --- ページ2: テキストのみ ---
  const page2 = pdfDoc.addPage([595, 842]);
  page2.drawText('Page 2 - Text Only', {
    x: 50,
    y: 800,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });

  for (let i = 0; i < 20; i++) {
    page2.drawText(`Line ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`, {
      x: 50,
      y: 760 - i * 25,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  page2.drawText('Page 2 of 2', {
    x: 50,
    y: 30,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  const outPath = path.join(__dirname, 'test.pdf');
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`Test PDF generated: ${outPath} (${(pdfBytes.length / 1024).toFixed(1)} KB)`);
}

/**
 * 最小限のJPEGファイルを生成
 * Canvas がないNode環境向けに、生のJPEGバイト列を作る
 * → 巨大なランダムデータをJPEGヘッダーで包む方式ではなく、
 *   大きな非圧縮BMPをpdf-libに渡す方式に変更
 *
 * 実際にはpdf-libはPNG埋め込みもサポートしているので、
 * 非圧縮のPNGを生成してembedPngする方式を使う
 */
function createLargeJpeg(width, height) {
  // 最小限のJFIF JPEGを手動構築
  // 実際のE2Eテストでは、圧縮対象となる十分なサイズの画像が必要
  // ここでは非圧縮に近い低品質のJPEGデータを生成

  // より簡単な方法: 大きなランダムバイト列をJPEGとして使う代わりに、
  // 有効なJPEGを作る必要がある

  // canvas を使えないのでpure JSで最小JPEG生成は困難
  // 代わりに、十分大きいダミーデータを持つ有効なJPEG構造を作る

  // 方法: 1x1のJPEGを基にして、大きなデータブロックを含むようにする
  // しかしこれは複雑すぎるので、別の方法を取る

  // 実際のアプローチ: テスト用にpdfにPNG画像を埋め込む
  // → generateTestPdf を修正してPNGを使用

  // 最も現実的なアプローチ: ダミーの大きなPNGデータを作成
  // pdf-lib の embedPng は生のPNGバイト列を受け取る

  // しかしpdf-lib の embedJpg は有効なJPEGが必要
  // 最小の有効なJPEGを作成して繰り返しデータで膨らませる

  // 簡易的に大きなJPEGっぽいデータを作る
  // 実テストでは実際の画像ファイルを使うべきだが、ここでは
  // pdf-lib に PNG を埋め込む方式に切り替える
  return null; // 下の関数で差し替え
}

/**
 * 非圧縮PNGを生成（Node.js環境で外部ライブラリなし）
 */
function createPngBuffer(width, height) {
  // PNGの構造を手動構築
  const zlib = require('zlib');

  // ピクセルデータ生成（RGB グラデーション）
  const rawData = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 3 + 1);
    rawData[rowOffset] = 0; // フィルターバイト: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      rawData[pixelOffset] = Math.floor((x / width) * 255);     // R
      rawData[pixelOffset + 1] = Math.floor((y / height) * 255); // G
      rawData[pixelOffset + 2] = 128;                             // B
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 0 }); // 非圧縮で大きく

  // PNGファイル構築
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createPngChunk('IHDR', ihdr);

  // IDAT
  const idatChunk = createPngChunk('IDAT', compressed);

  // IEND
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createPngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// メイン関数を修正: PNG使用版
async function generateTestPdfWithPng() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // ページ1: テキスト + 大きなPNG画像
  const page1 = pdfDoc.addPage([595, 842]);
  page1.drawText('PDF Resize Tool - Test Document', {
    x: 50, y: 800, size: 18, font, color: rgb(0, 0, 0),
  });
  page1.drawText('This text should remain selectable after compression.', {
    x: 50, y: 770, size: 12, font, color: rgb(0.2, 0.2, 0.2),
  });
  page1.drawText('Page 1 of 2', {
    x: 50, y: 30, size: 10, font, color: rgb(0.5, 0.5, 0.5),
  });

  // 大きなPNG画像（1600x1200、非圧縮で大きくなる）
  const pngBuffer = createPngBuffer(1600, 1200);
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  page1.drawImage(pngImage, {
    x: 50, y: 200, width: 495, height: 371,
  });

  // ページ2: テキストのみ
  const page2 = pdfDoc.addPage([595, 842]);
  page2.drawText('Page 2 - Text Only', {
    x: 50, y: 800, size: 18, font, color: rgb(0, 0, 0),
  });
  for (let i = 0; i < 20; i++) {
    page2.drawText(`Line ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`, {
      x: 50, y: 760 - i * 25, size: 11, font, color: rgb(0.1, 0.1, 0.1),
    });
  }
  page2.drawText('Page 2 of 2', {
    x: 50, y: 30, size: 10, font, color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  const outPath = path.join(__dirname, 'test.pdf');
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`Test PDF generated: ${outPath} (${(pdfBytes.length / 1024).toFixed(1)} KB)`);
}

/**
 * アルファチャネル付きPNGを生成（SMaskテスト用）
 * color type 6 = RGBA
 */
function createPngBufferWithAlpha(width, height) {
  const zlib = require('zlib');

  // ピクセルデータ生成（RGBA グラデーション + アルファグラデーション）
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    rawData[rowOffset] = 0; // フィルターバイト: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = Math.floor((x / width) * 255);       // R
      rawData[pixelOffset + 1] = Math.floor((y / height) * 255);  // G
      rawData[pixelOffset + 2] = 180;                               // B
      // アルファ: 左上は透明、右下は不透明のグラデーション
      const alpha = Math.floor(((x / width) * 0.5 + (y / height) * 0.5) * 255);
      rawData[pixelOffset + 3] = Math.min(alpha, 254); // 254以下を保証してSMask生成を確実にする
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 0 }); // 非圧縮で大きく

  // PNGファイル構築
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createPngChunk('IHDR', ihdr);

  // IDAT
  const idatChunk = createPngChunk('IDAT', compressed);

  // IEND
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * SMask付きテストPDFを生成
 * - Page 1: 大きなFlate/raw画像（不透明PNG）
 * - Page 2: SMask付き画像（RGBA PNG）
 * - Page 3: テキストのみ
 */
async function generateTestPdfWithSmask() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // ページ1: 大きなFlate/raw画像（不透明）
  const page1 = pdfDoc.addPage([595, 842]);
  page1.drawText('Page 1 - Opaque Flate Image', {
    x: 50, y: 800, size: 18, font, color: rgb(0, 0, 0),
  });

  const opaquePng = createPngBuffer(1600, 1200);
  const opaqueImage = await pdfDoc.embedPng(opaquePng);
  page1.drawImage(opaqueImage, {
    x: 50, y: 200, width: 495, height: 371,
  });

  // ページ2: SMask付き画像（RGBA）
  const page2 = pdfDoc.addPage([595, 842]);
  page2.drawText('Page 2 - Transparent Image with SMask', {
    x: 50, y: 800, size: 18, font, color: rgb(0, 0, 0),
  });

  const alphaPng = createPngBufferWithAlpha(1200, 900);
  const alphaImage = await pdfDoc.embedPng(alphaPng);
  page2.drawImage(alphaImage, {
    x: 50, y: 200, width: 495, height: 371,
  });

  // ページ3: テキストのみ
  const page3 = pdfDoc.addPage([595, 842]);
  page3.drawText('Page 3 - Text Only', {
    x: 50, y: 800, size: 18, font, color: rgb(0, 0, 0),
  });
  for (let i = 0; i < 10; i++) {
    page3.drawText(`Line ${i + 1}: Test content for compression verification.`, {
      x: 50, y: 760 - i * 25, size: 11, font, color: rgb(0.1, 0.1, 0.1),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const outPath = path.join(__dirname, 'test-smask.pdf');
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`SMask test PDF generated: ${outPath} (${(pdfBytes.length / 1024).toFixed(1)} KB)`);
}

Promise.all([
  generateTestPdfWithPng(),
  generateTestPdfWithSmask(),
]).catch(console.error);
