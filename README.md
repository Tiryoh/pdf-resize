# PDF Resize Tool

[日本語](README.ja.md)

A browser-based PDF compression tool. Reduces file size by selectively re-compressing embedded images while preserving text selection, fonts, and vector elements.

All processing runs locally in your browser — no files are sent to any server.

## Usage

If you just want to use it, the hosted version is recommended:

https://pdf-resize.tiryoh.com/

For local development, open `index.html` in a browser, or start a local preview server:

```bash
pnpm install
pnpm run preview
# Visit http://127.0.0.1:4173
```

1. Drag & drop a PDF file (or click to select)
2. Choose a compression preset or adjust settings
3. Click "Compress"
4. Download the compressed PDF

### Compression Presets

| Preset | JPEG Quality | Max Dimension | Description |
|---|---|---|---|
| Light | 90% | 4096px | High quality, minimal compression |
| Standard | 75% | 2048px | Balanced (default) |
| Maximum | 50% | 1024px | Smallest file size |

## How It Works

Text, fonts, and vector elements in the PDF are kept intact. Only **embedded images** are conditionally re-compressed.

### Compression Targets

Only images meeting **both** conditions are compressed:

| Condition | Default Threshold |
|---|---|
| Total pixel count | ≥ 90,000 (equivalent to 300×300) |
| Raw data size | ≥ 100 KB |

### Skipped Images

Images matching any of the following are left untouched:

| Condition | Reason |
|---|---|
| Small images (icons, logos, etc.) | Degradation would be noticeable |
| Small data size | Negligible savings |
| JBIG2 / JPX format | Cannot decode in browser |
| CMYK color space | Complex color conversion |
| Indexed/palette images | Logos and diagrams degrade visibly |
| Compressed size ≥ 90% of original | Deemed ineffective; original data kept |

### Transparency Handling

| Mode | Description |
|---|---|
| Compress individually (default) | Compresses RGB and alpha mask (SMask) separately as JPEG |
| Flatten to white | Composites onto white background before compression |
| Skip | Leaves transparent images untouched |

### Default Settings

| Parameter | Default | Description |
|---|---|---|
| JPEG Quality | 75% | Quality for JPEG re-encoding |
| Max Dimension | 2048px | Images larger than this are downsampled |
| Min Image Size | 300px | Images smaller than this on each side are skipped |
| Min Data Size | 100 KB | Images below this threshold are skipped |
| Transparency | Compress individually | Can also flatten or skip |

## Development

### Prerequisites

- Node.js 22+
- pnpm

### Setup

```bash
pnpm install
```

### Preview

```bash
pnpm run preview
# Visit http://127.0.0.1:4173
```

### Testing

```bash
# Generate test PDFs
pnpm generate-test-pdf

# Run E2E tests
pnpm test
```

### File Structure

```
pdf-resize/
├── index.html              # Main HTML
├── css/style.css           # Styles
├── js/
│   ├── i18n.js             # Internationalization (JA/EN)
│   ├── app.js              # UI logic & file I/O
│   ├── pdf-processor.js    # PDF parsing, image extraction & replacement
│   └── image-compressor.js # Canvas-based image re-compression
├── tests/
│   ├── e2e.spec.js         # E2E tests (Playwright)
│   └── generate-test-pdf.js # Test PDF generation
└── playwright.config.js    # Test configuration
```

## Tech Stack

- [pdf-lib](https://github.com/Hopding/pdf-lib) — PDF read/write
- [pako](https://github.com/nodeca/pako) — Flate compression/decompression
- Canvas API — Image downsampling & JPEG re-encoding
- [Playwright](https://playwright.dev/) — E2E testing

## Limitations

- Password-protected PDFs may not be processable
- CMYK images are skipped for safety
- Uses internal pdf-lib APIs for image replacement; behavior may change with library updates

## License

MIT
