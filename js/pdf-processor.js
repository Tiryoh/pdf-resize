/**
 * pdf-processor.js
 * PDF解析・画像抽出・条件判定・置換のメインロジック
 */

const PdfProcessor = (() => {

  const { PDFDocument, PDFName, PDFRawStream, PDFStream, PDFArray, PDFDict, PDFRef, PDFNumber } = PDFLib;

  /**
   * PDFオブジェクトから安全に数値を取得
   */
  function getNumericValue(obj) {
    if (obj == null) return undefined;
    if (obj instanceof PDFNumber) return obj.asNumber();
    if (typeof obj.numberValue === 'function') return obj.numberValue();
    if (typeof obj.asNumber === 'function') return obj.asNumber();
    if (typeof obj.value === 'number') return obj.value;
    const n = Number(obj.toString());
    return isNaN(n) ? undefined : n;
  }

  /**
   * PDF内のすべての画像ストリームを列挙してメタデータを取得
   * @param {PDFDocument} pdfDoc
   * @returns {Array<Object>} 画像情報リスト
   */
  function enumerateImages(pdfDoc) {
    const images = [];
    const context = pdfDoc.context;

    for (const [ref, obj] of context.enumerateIndirectObjects()) {
      // PDFRawStream または PDFStream かチェック
      if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) {
        continue;
      }

      const dict = obj.dict;
      const subtype = dict.get(PDFName.of('Subtype'));
      if (!subtype || subtype.toString() !== '/Image') {
        continue;
      }

      const width = getNumericValue(dict.get(PDFName.of('Width')));
      const height = getNumericValue(dict.get(PDFName.of('Height')));
      const bitsPerComponent = getNumericValue(dict.get(PDFName.of('BitsPerComponent'))) ?? 8;

      // Filter (圧縮方式)
      const filterObj = dict.get(PDFName.of('Filter'));
      const filter = resolveFilter(filterObj);

      // ColorSpace
      const colorSpaceObj = dict.get(PDFName.of('ColorSpace'));
      const colorSpace = resolveColorSpace(colorSpaceObj, context);

      // SMask (透過)
      const smaskRef = dict.get(PDFName.of('SMask'));

      // 生データサイズ
      const contents = obj.contents;
      const dataSize = contents ? contents.length : 0;

      images.push({
        ref,
        obj,
        dict,
        width: Number(width),
        height: Number(height),
        bitsPerComponent: Number(bitsPerComponent),
        filter,
        colorSpace,
        smaskRef,
        dataSize,
      });
    }

    return images;
  }

  /**
   * Filterオブジェクトを文字列に解決
   */
  function resolveFilter(filterObj) {
    if (!filterObj) return null;
    if (filterObj instanceof PDFName) return filterObj.toString();
    if (filterObj instanceof PDFArray) {
      // 複数フィルタの場合は最後のフィルタ（最終デコード形式）を返す
      const last = filterObj.get(filterObj.size() - 1);
      return last?.toString() ?? null;
    }
    return filterObj.toString?.() ?? null;
  }

  /**
   * ColorSpaceを文字列に解決
   */
  function resolveColorSpace(csObj, context) {
    if (!csObj) return 'DeviceRGB'; // デフォルト
    if (csObj instanceof PDFName) return csObj.toString();
    if (csObj instanceof PDFRef) {
      const resolved = context.lookup(csObj);
      return resolveColorSpace(resolved, context);
    }
    if (csObj instanceof PDFArray && csObj.size() > 0) {
      const first = csObj.get(0);
      return first?.toString() ?? 'Unknown';
    }
    return csObj.toString?.() ?? 'Unknown';
  }

  /**
   * ColorSpaceからコンポーネント数を推定
   */
  function getComponentCount(colorSpace) {
    const cs = colorSpace.replace('/', '');
    switch (cs) {
      case 'DeviceGray': return 1;
      case 'DeviceRGB': return 3;
      case 'DeviceCMYK': return 4;
      case 'CalGray': return 1;
      case 'CalRGB': return 3;
      default: return null; // 不明
    }
  }

  /**
   * 画像が圧縮対象かどうかを判定
   * @param {Object} imageInfo - enumerateImagesの戻り値の要素
   * @param {Object} settings
   * @returns {{ shouldProcess: boolean, reason: string }}
   */
  function shouldProcessImage(imageInfo, settings) {
    const {
      minPixelThreshold = 90000,
      minByteThreshold = 102400,
      transparencyMode = 'flatten',
    } = settings;

    const { width, height, filter, colorSpace, smaskRef, dataSize } = imageInfo;
    const totalPixels = width * height;

    // JBIG2 / JPX はデコード不可
    if (filter === '/JBIG2Decode' || filter === '/JPXDecode') {
      return { shouldProcess: false, reason: 'デコード不可 (JBIG2/JPX)' };
    }

    // CMYK はスキップ
    const cs = colorSpace.replace('/', '');
    if (cs === 'DeviceCMYK') {
      return { shouldProcess: false, reason: 'CMYK画像' };
    }

    // Indexed (パレット画像) はスキップ
    if (cs === 'Indexed') {
      return { shouldProcess: false, reason: 'パレット画像 (Indexed)' };
    }

    // ICCBased の CMYK もスキップ（コンポーネント数で判定）
    if (cs === 'ICCBased') {
      // ICCBasedの場合、コンポーネント数が不明なのでスキップが安全
      return { shouldProcess: false, reason: 'ICCBased (安全のためスキップ)' };
    }

    // コンポーネント数が不明な場合はスキップ
    const components = getComponentCount(colorSpace);
    if (components === null) {
      return { shouldProcess: false, reason: `不明なColorSpace: ${colorSpace}` };
    }

    // 透過画像の処理
    if (smaskRef && transparencyMode === 'skip') {
      return { shouldProcess: false, reason: '透過画像 (スキップ設定)' };
    }

    // Flate/raw画像はJPEG変換の効果が高いため閾値を下げる
    const isRawOrFlate = (filter === '/FlateDecode' || filter === null);
    const effectivePixelThreshold = isRawOrFlate ? Math.floor(minPixelThreshold / 4) : minPixelThreshold;
    const effectiveByteThreshold = isRawOrFlate ? Math.floor(minByteThreshold / 4) : minByteThreshold;

    // ピクセル数チェック
    if (totalPixels < effectivePixelThreshold) {
      return { shouldProcess: false, reason: `小さい画像 (${width}x${height})` };
    }

    // データサイズチェック
    if (dataSize < effectiveByteThreshold) {
      return { shouldProcess: false, reason: `データサイズ小 (${(dataSize / 1024).toFixed(1)}KB)` };
    }

    return { shouldProcess: true, reason: '圧縮対象' };
  }

  /**
   * SMaskオブジェクトからピクセルデータをデコード
   * @param {PDFRef} smaskRef
   * @param {PDFDocument} pdfDoc
   * @returns {{ pixels: Uint8Array, width: number, height: number } | null}
   */
  function decodeSmask(smaskRef, pdfDoc) {
    const smaskObj = pdfDoc.context.lookup(smaskRef);
    if (!(smaskObj instanceof PDFRawStream) && !(smaskObj instanceof PDFStream)) {
      return null;
    }
    const smaskDict = smaskObj.dict;
    const smaskW = Number(getNumericValue(smaskDict.get(PDFName.of('Width'))));
    const smaskH = Number(getNumericValue(smaskDict.get(PDFName.of('Height'))));
    const smaskFilter = resolveFilter(smaskDict.get(PDFName.of('Filter')));

    let smaskPixels;
    if (smaskFilter === '/FlateDecode') {
      smaskPixels = pako.inflate(smaskObj.contents);
    } else if (smaskFilter === '/DCTDecode') {
      // 既にJPEG圧縮されたSMaskはスキップ
      return null;
    } else {
      smaskPixels = smaskObj.contents;
    }

    return { pixels: smaskPixels, width: smaskW, height: smaskH };
  }

  /**
   * 画像ストリームをデコードして生ピクセルデータを取得
   * @param {Object} imageInfo
   * @param {PDFDocument} pdfDoc
   * @param {string} transparencyMode - 'flatten' | 'skip' | 'compress'
   * @returns {Promise<{ bitmap: ImageBitmap, smaskData: Object|null }>}
   */
  async function decodeImage(imageInfo, pdfDoc, transparencyMode) {
    const { obj, filter, width, height, colorSpace, smaskRef } = imageInfo;
    const components = getComponentCount(colorSpace);
    let bitmap;

    if (filter === '/DCTDecode') {
      const jpegBytes = obj.contents;
      bitmap = await ImageCompressor.jpegToImageBitmap(jpegBytes);
    } else if (filter === '/FlateDecode' || filter === null) {
      let rawPixels;
      if (filter === '/FlateDecode') {
        rawPixels = pako.inflate(obj.contents);
      } else {
        rawPixels = obj.contents;
      }
      bitmap = await ImageCompressor.rawPixelsToImageBitmap(rawPixels, width, height, components);
    } else {
      throw new Error(`Unsupported filter: ${filter}`);
    }

    let smaskData = null;

    // SMask処理
    if (smaskRef) {
      const decoded = decodeSmask(smaskRef, pdfDoc);
      if (decoded) {
        if (transparencyMode === 'compress') {
          // SMaskを個別に保持して後でJPEG圧縮する
          smaskData = { ...decoded, ref: smaskRef };
        } else {
          // 従来: 白背景で合成
          bitmap = await ImageCompressor.flattenWithWhiteBackground(
            bitmap, decoded.pixels, decoded.width, decoded.height
          );
        }
      }
    }

    return { bitmap, smaskData };
  }

  /**
   * 圧縮済みJPEGバイト列から新しいPDFストリームオブジェクトを作り、
   * 元の画像を置換する
   * @param {PDFDocument} pdfDoc
   * @param {PDFRef} originalRef
   * @param {Uint8Array} jpegBytes
   * @param {number} width - 圧縮後の幅
   * @param {number} height - 圧縮後の高さ
   * @param {PDFRef} [smaskRef] - SMask参照 (省略時はSMaskなし)
   */
  function replaceImageStream(pdfDoc, originalRef, jpegBytes, width, height, smaskRef) {
    const context = pdfDoc.context;

    const newDict = new Map();
    newDict.set(PDFName.of('Type'), PDFName.of('XObject'));
    newDict.set(PDFName.of('Subtype'), PDFName.of('Image'));
    newDict.set(PDFName.of('Width'), context.obj(width));
    newDict.set(PDFName.of('Height'), context.obj(height));
    newDict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
    newDict.set(PDFName.of('BitsPerComponent'), context.obj(8));
    newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
    newDict.set(PDFName.of('Length'), context.obj(jpegBytes.length));
    if (smaskRef) {
      newDict.set(PDFName.of('SMask'), smaskRef);
    }

    const dictObj = PDFDict.fromMapWithContext(newDict, context);
    const newStream = PDFRawStream.of(dictObj, jpegBytes);

    context.assign(originalRef, newStream);
  }

  /**
   * SMaskストリームをJPEG圧縮して置換する
   * @param {PDFDocument} pdfDoc
   * @param {PDFRef} smaskRef - 既存のSMask参照
   * @param {Uint8Array} jpegBytes - JPEG圧縮済みのグレースケールデータ
   * @param {number} width
   * @param {number} height
   */
  function replaceSmaskStream(pdfDoc, smaskRef, jpegBytes, width, height) {
    const context = pdfDoc.context;

    const newDict = new Map();
    newDict.set(PDFName.of('Type'), PDFName.of('XObject'));
    newDict.set(PDFName.of('Subtype'), PDFName.of('Image'));
    newDict.set(PDFName.of('Width'), context.obj(width));
    newDict.set(PDFName.of('Height'), context.obj(height));
    newDict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceGray'));
    newDict.set(PDFName.of('BitsPerComponent'), context.obj(8));
    newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
    newDict.set(PDFName.of('Length'), context.obj(jpegBytes.length));

    const dictObj = PDFDict.fromMapWithContext(newDict, context);
    const newStream = PDFRawStream.of(dictObj, jpegBytes);

    context.assign(smaskRef, newStream);
  }

  /**
   * PDFを処理する（メインエントリポイント）
   * @param {ArrayBuffer} pdfBuffer
   * @param {Object} settings
   * @param {function} onProgress - 進捗コールバック (processed, total, currentInfo)
   * @returns {Promise<{ outputBytes: Uint8Array, stats: Object }>}
   */
  async function processPdf(pdfBuffer, settings, onProgress) {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

    const images = enumerateImages(pdfDoc);
    const totalImages = images.length;

    if (totalImages === 0) {
      const outputBytes = await pdfDoc.save();
      return {
        outputBytes,
        stats: { totalImages: 0, compressedCount: 0, skippedCount: 0, originalTotalBytes: 0, compressedTotalBytes: 0 },
      };
    }

    let processedCount = 0;
    let compressedCount = 0;
    let skippedCount = 0;
    let originalTotalBytes = 0;
    let compressedTotalBytes = 0;

    const skipIfNoGain = settings.skipIfNoGain ?? 0.9;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const { shouldProcess, reason } = shouldProcessImage(img, settings);

      if (!shouldProcess) {
        skippedCount++;
        onProgress?.(i + 1, totalImages, { status: 'skipped', reason, width: img.width, height: img.height });
        continue;
      }

      try {
        const transparencyMode = settings.transparencyMode ?? 'flatten';

        // デコード
        const { bitmap, smaskData } = await decodeImage(img, pdfDoc, transparencyMode);

        // 再圧縮
        const compressedBytes = await ImageCompressor.compressToJpeg(bitmap, {
          quality: settings.jpegQuality ?? 0.75,
          maxDimension: settings.maxDimension ?? 2048,
        });

        bitmap.close();

        const originalBytes = img.dataSize;
        originalTotalBytes += originalBytes;

        // Flate/raw画像はほぼ確実に圧縮効果があるため安全弁を緩める
        const isRawOrFlate = (img.filter === '/FlateDecode' || img.filter === null);
        const effectiveSkipRatio = isRawOrFlate ? 1.0 : skipIfNoGain;

        // サイズ比較（安全弁）
        if (compressedBytes.length >= originalBytes * effectiveSkipRatio) {
          skippedCount++;
          compressedTotalBytes += originalBytes;
          onProgress?.(i + 1, totalImages, {
            status: 'no-gain',
            reason: `圧縮効果なし (${(compressedBytes.length / originalBytes * 100).toFixed(0)}%)`,
            width: img.width,
            height: img.height,
          });
          continue;
        }

        // 圧縮後の画像サイズを計算（ダウンサンプリング後）
        let newWidth = img.width;
        let newHeight = img.height;
        const maxDim = settings.maxDimension ?? 2048;
        const maxSide = Math.max(newWidth, newHeight);
        if (maxSide > maxDim) {
          const scale = maxDim / maxSide;
          newWidth = Math.round(newWidth * scale);
          newHeight = Math.round(newHeight * scale);
        }

        // SMask個別JPEG圧縮
        let smaskRefForReplace = undefined;
        if (smaskData) {
          const smaskQuality = Math.min((settings.jpegQuality ?? 0.75) + 0.1, 1.0);
          // SMaskも本体画像と同じ比率でリサイズ
          let smaskTargetW = smaskData.width;
          let smaskTargetH = smaskData.height;
          if (maxSide > maxDim) {
            const scale = maxDim / maxSide;
            smaskTargetW = Math.round(smaskData.width * scale);
            smaskTargetH = Math.round(smaskData.height * scale);
          }

          const smaskResult = await ImageCompressor.compressSmaskToJpeg(
            smaskData.pixels, smaskData.width, smaskData.height,
            { quality: smaskQuality, targetWidth: smaskTargetW, targetHeight: smaskTargetH }
          );

          replaceSmaskStream(pdfDoc, smaskData.ref, smaskResult.jpegBytes, smaskResult.newWidth, smaskResult.newHeight);
          smaskRefForReplace = smaskData.ref;
        }

        // 置換
        replaceImageStream(pdfDoc, img.ref, compressedBytes, newWidth, newHeight, smaskRefForReplace);
        compressedCount++;
        compressedTotalBytes += compressedBytes.length;

        onProgress?.(i + 1, totalImages, {
          status: 'compressed',
          reason: `${(originalBytes / 1024).toFixed(0)}KB → ${(compressedBytes.length / 1024).toFixed(0)}KB`,
          width: img.width,
          height: img.height,
        });
      } catch (err) {
        console.warn(`画像の処理に失敗 (${img.width}x${img.height}):`, err);
        skippedCount++;
        onProgress?.(i + 1, totalImages, {
          status: 'error',
          reason: err.message,
          width: img.width,
          height: img.height,
        });
      }
    }

    const outputBytes = await pdfDoc.save();

    return {
      outputBytes,
      stats: {
        totalImages,
        compressedCount,
        skippedCount,
        originalTotalBytes,
        compressedTotalBytes,
      },
    };
  }

  return { processPdf };

})();
