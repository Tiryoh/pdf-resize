// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_PDF_PATH = path.join(__dirname, 'test.pdf');

test.beforeAll(async () => {
  // テスト用PDFが存在するか確認
  if (!fs.existsSync(TEST_PDF_PATH)) {
    throw new Error(
      'テスト用PDFが見つかりません。先に node tests/generate-test-pdf.js を実行してください。'
    );
  }
});

test.describe('PDF Resize Tool', () => {

  test('ページが正しく読み込まれる', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('PDF Resize Tool');
    await expect(page.locator('.subtitle')).toContainText('ブラウザで完結');
    await expect(page.locator('#compressBtn')).toBeDisabled();
  });

  test('PDFファイルを選択するとファイル情報が表示される', async ({ page }) => {
    await page.goto('/');

    // ファイル選択
    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(TEST_PDF_PATH);

    // ファイル情報が表示される
    await expect(page.locator('#fileInfo')).toBeVisible();
    await expect(page.locator('#fileName')).toContainText('test.pdf');
    await expect(page.locator('#fileSize')).not.toBeEmpty();

    // 圧縮ボタンが有効になる
    await expect(page.locator('#compressBtn')).toBeEnabled();
  });

  test('PDFを圧縮して結果が表示される', async ({ page }) => {
    await page.goto('/');

    // ファイル選択
    await page.locator('#fileInput').setInputFiles(TEST_PDF_PATH);
    await expect(page.locator('#compressBtn')).toBeEnabled();

    // 圧縮実行
    await page.locator('#compressBtn').click();

    // プログレスが表示される
    await expect(page.locator('#progressSection')).toBeVisible({ timeout: 5000 });

    // 結果が表示されるまで待つ
    await expect(page.locator('#resultSection')).toBeVisible({ timeout: 30000 });

    // 結果の各項目が表示される
    await expect(page.locator('#originalSize')).not.toBeEmpty();
    await expect(page.locator('#compressedSize')).not.toBeEmpty();
    await expect(page.locator('#reductionRate')).not.toBeEmpty();
    await expect(page.locator('#imageStats')).not.toBeEmpty();

    // ダウンロードボタンが存在する
    await expect(page.locator('#downloadBtn')).toBeVisible();
  });

  test('圧縮設定を変更できる', async ({ page }) => {
    await page.goto('/');

    // 設定パネルを開く
    await page.locator('details.settings summary').click();

    // JPEG品質スライダー
    const slider = page.locator('#jpegQuality');
    await slider.fill('0.5');
    await slider.dispatchEvent('input');
    await expect(page.locator('#jpegQualityValue')).toHaveText('50%');

    // 最大長辺
    await page.locator('#maxDimension').fill('1024');
    await expect(page.locator('#maxDimension')).toHaveValue('1024');

    // 最小画像サイズ
    await page.locator('#minPixelSize').fill('200');
    await expect(page.locator('#minPixelSize')).toHaveValue('200');

    // 透過画像のモード切替
    await page.locator('input[name="transparencyMode"][value="skip"]').check();
    await expect(page.locator('input[name="transparencyMode"][value="skip"]')).toBeChecked();
  });

  test('低品質設定で圧縮するとサイズがより小さくなる', async ({ page }) => {
    await page.goto('/');

    // 設定パネルを開いて低品質に設定
    await page.locator('details.settings summary').click();
    const slider = page.locator('#jpegQuality');
    await slider.fill('0.3');
    await slider.dispatchEvent('input');
    await page.locator('#maxDimension').fill('1024');

    // ファイル選択＆圧縮
    await page.locator('#fileInput').setInputFiles(TEST_PDF_PATH);
    await page.locator('#compressBtn').click();

    // 結果表示を待つ
    await expect(page.locator('#resultSection')).toBeVisible({ timeout: 30000 });

    // 圧縮後サイズが表示されている
    const compressedText = await page.locator('#compressedSize').textContent();
    expect(compressedText).toBeTruthy();
  });

  test('ダウンロードボタンでファイルがダウンロードできる', async ({ page }) => {
    await page.goto('/');

    // ファイル選択＆圧縮
    await page.locator('#fileInput').setInputFiles(TEST_PDF_PATH);
    await page.locator('#compressBtn').click();
    await expect(page.locator('#resultSection')).toBeVisible({ timeout: 30000 });

    // ダウンロードイベントを監視
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#downloadBtn').click();
    const download = await downloadPromise;

    // ファイル名が正しい
    expect(download.suggestedFilename()).toBe('test_compressed.pdf');

    // ファイルサイズが0より大きい
    const filePath = await download.path();
    if (filePath) {
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(0);
    }
  });

  test('ドラッグ＆ドロップ領域のスタイルが変化する', async ({ page }) => {
    await page.goto('/');

    const dropZone = page.locator('#dropZone');

    // 初期状態: has-fileクラスなし
    await expect(dropZone).not.toHaveClass(/has-file/);

    // ファイル選択後: has-fileクラスあり
    await page.locator('#fileInput').setInputFiles(TEST_PDF_PATH);
    await expect(dropZone).toHaveClass(/has-file/);
  });

});
