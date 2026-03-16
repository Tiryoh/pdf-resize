/**
 * image-compressor.js
 * Canvas APIによる画像デコード・ダウンサンプリング・JPEG再圧縮
 */

const ImageCompressor = (() => {

  /**
   * 生のピクセルデータからImageBitmapを生成
   * @param {Uint8Array} rawPixels - デコード済みピクセルデータ
   * @param {number} width
   * @param {number} height
   * @param {number} components - 色コンポーネント数 (1=Gray, 3=RGB, 4=CMYK)
   * @returns {Promise<ImageBitmap>}
   */
  async function rawPixelsToImageBitmap(rawPixels, width, height, components) {
    const rgba = new Uint8ClampedArray(width * height * 4);

    if (components === 3) {
      // RGB → RGBA
      for (let i = 0, j = 0; i < rawPixels.length; i += 3, j += 4) {
        rgba[j] = rawPixels[i];
        rgba[j + 1] = rawPixels[i + 1];
        rgba[j + 2] = rawPixels[i + 2];
        rgba[j + 3] = 255;
      }
    } else if (components === 1) {
      // Grayscale → RGBA
      for (let i = 0, j = 0; i < rawPixels.length; i += 1, j += 4) {
        rgba[j] = rawPixels[i];
        rgba[j + 1] = rawPixels[i];
        rgba[j + 2] = rawPixels[i];
        rgba[j + 3] = 255;
      }
    } else {
      throw new Error(`Unsupported component count: ${components}`);
    }

    const imageData = new ImageData(rgba, width, height);
    return createImageBitmap(imageData);
  }

  /**
   * JPEGバイト列からImageBitmapを生成
   * @param {Uint8Array} jpegBytes
   * @returns {Promise<ImageBitmap>}
   */
  async function jpegToImageBitmap(jpegBytes) {
    const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
    return createImageBitmap(blob);
  }

  /**
   * SMask (アルファマスク) を適用してImageBitmapを白背景で合成
   * @param {ImageBitmap} bitmap
   * @param {Uint8Array} smaskPixels - SMaskの生ピクセルデータ (Grayscale)
   * @param {number} smaskWidth
   * @param {number} smaskHeight
   * @returns {Promise<ImageBitmap>}
   */
  async function flattenWithWhiteBackground(bitmap, smaskPixels, smaskWidth, smaskHeight) {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');

    // 白背景を描画
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 元画像を描画
    ctx.drawImage(bitmap, 0, 0);

    // ImageDataを取得してアルファを適用
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // SMaskのサイズが異なる場合はリサイズが必要だが、
    // 通常は同サイズなので直接適用
    if (smaskWidth === canvas.width && smaskHeight === canvas.height) {
      for (let i = 0; i < smaskPixels.length; i++) {
        const alpha = smaskPixels[i] / 255;
        const j = i * 4;
        // アルファを適用して白背景と合成
        data[j] = Math.round(data[j] * alpha + 255 * (1 - alpha));
        data[j + 1] = Math.round(data[j + 1] * alpha + 255 * (1 - alpha));
        data[j + 2] = Math.round(data[j + 2] * alpha + 255 * (1 - alpha));
        data[j + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return createImageBitmap(canvas);
  }

  /**
   * ImageBitmapをダウンサンプリングしてJPEGに再圧縮
   * @param {ImageBitmap} bitmap
   * @param {Object} options
   * @param {number} options.quality - JPEG品質 (0.0〜1.0)
   * @param {number} options.maxDimension - 最大長辺ピクセル数
   * @returns {Promise<Uint8Array>} - JPEG バイト列
   */
  async function compressToJpeg(bitmap, options) {
    const { quality = 0.75, maxDimension = 2048 } = options;

    let targetWidth = bitmap.width;
    let targetHeight = bitmap.height;

    // ダウンサンプリング判定
    const maxSide = Math.max(targetWidth, targetHeight);
    if (maxSide > maxDimension) {
      const scale = maxDimension / maxSide;
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // 高品質リサンプリング
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 白背景（JPEGは透過非対応のため）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          blob.arrayBuffer().then(buf => {
            resolve(new Uint8Array(buf));
          });
        },
        'image/jpeg',
        quality
      );
    });
  }

  return {
    rawPixelsToImageBitmap,
    jpegToImageBitmap,
    flattenWithWhiteBackground,
    compressToJpeg,
  };

})();
