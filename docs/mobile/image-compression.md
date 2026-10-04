# Image Processing & Compression Pipeline

This document details the client-side and server-side image processing, resolution reduction, and compression pipeline introduced in Rayuela.

---

## 1. Context & Motivation

Volunteers in citizen science projects take observations in outdoor field environments (parks, riversides, trails) where mobile cellular bandwidth is limited, intermittent, or metered. 

Modern mobile devices capture photographs at high resolutions (e.g., $12\text{ MP}$ to $48\text{ MP}+$), resulting in file sizes ranging from **$3\text{ MB}$ to $15\text{ MB}+$ per picture**. For a check-in with up to 3 photos:
- Submitting an uncompressed check-in would require uploading **$10\text{ MB}$ to $40\text{ MB}$** over cellular data.
- Uploads on slow connections frequently timed out (90s limit).
- Local offline Outbox storage quickly consumed hundreds of megabytes on user devices.
- Object storage (Garage S3) was burdened with storing raw camera resolutions unnecessary for scientific identification.

To eliminate this friction, Rayuela implements a **two-tier optimization pipeline**:
1. **Tier 1 (Client-side, Flutter):** Immediate resize and compression upon camera capture or gallery selection before writing to local state or persistent disk.
2. **Tier 2 (Server-side, NestJS):** Uniform normalization and compression via `sharp` before writing to S3 object storage.

---

## 2. Empirical Benchmark (Before vs. After)

During end-to-end integration testing in the local development environment (Pixel 8 API 33 emulator uploading to Garage S3), a high-resolution sample image ($6.6\text{ MB}$) was processed through the complete pipeline:

| Metric | Original Device Photo | Stored in Garage S3 | Impact |
| :--- | :--- | :--- | :--- |
| **File Size** | **6,605 KB (6.6 MB)** | **398.46 KB** | **-94%** reduction |
| **Max Dimensions** | Native camera ($4000\times3000$+ px) | **$1600\times1000$ px** | Proportional downscaling |
| **Format & Quality** | Raw JPEG / HEIC (100%) | **JPEG (Quality 80)** | Stripped metadata, optimized Huffman |
| **Storage Key** | Device Temporary Cache | `checkins/<userId>/<uuid>.jpg` | S3 standard object storage |

> **Key Result:** Bandwidth usage and cloud storage footprint are reduced by **~94%** while preserving sharp detail and visual clarity required for species and specimen verification.

---

## 3. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Mobile["📱 Mobile Client (Flutter)"]
        Cam["📸 Camera / Gallery"] --> RawBytes["Original Bytes (6.6 MB)"]
        RawBytes --> FlutterCompress{"FlutterImageCompress\n(max 1600px, q80)"}
        FlutterCompress -->|Success| CompBytes["Compressed Bytes (~400 KB)"]
        FlutterCompress -->|Error (Fail-Open)| RawBytesFallback["Original Bytes (Fallback)"]
        
        CompBytes --> State["CheckinWizardState"]
        RawBytesFallback --> State
        State --> DiskStore["ImageStore (outbox/<uuid>/<n>.jpg)"]
        DiskStore --> OutboxDao[("SQLite Outbox")]
        OutboxDao --> Upload["Multipart/form-data POST /checkin"]
    end

    subgraph Backend["🚀 Backend API (NestJS)"]
        Upload --> Controller["CheckinController"]
        Controller --> CheckinSvc["CheckinService.create()"]
        CheckinSvc --> SharpPipeline{"sharp(buffer)\nrotate() + resize(1600) + jpeg(q80)"}
        SharpPipeline -->|Success| S3Buffer["Optimized Buffer (~398 KB)"]
        SharpPipeline -->|Error (Fail-Open)| S3Fallback["Original Buffer (Fallback)"]
        
        S3Buffer --> S3[("Garage S3 (rayuela-checkins)")]
        S3Fallback --> S3
    end
```

---

## 4. Resilience Guarantee: Fail-Open Architecture

A core architectural principle in Rayuela is **zero user friction in field data collection**:
> *If compression fails for any unexpected reason (corrupted EXIF, missing native codecs, out-of-memory condition), the system must never interrupt the volunteer or reject the check-in. It transparently falls back to storing and uploading the original image.*

### Mobile Implementation (`rayuela-mobile`)
- **Location:** `CheckinWizardController` & `FlutterImageCompressorImpl` (`ImageStore`).
- **Mechanism:**
  - Before updating `CheckinWizardState.images`, `_compressImage()` runs `ImageCompressor.compressToJpeg(bytes, minWidth: 1600, minHeight: 1600, quality: 80)`.
  - Wrapped in a `try / catch (e, st)` block. On any exception, a warning is logged (`_log.warning('Image compression failed, using original: $e')`) and the original raw bytes are returned unaltered.
  - When storing offline check-in images in `ImageStore.persist()`, the same fail-open contract ensures files are safely written to disk regardless of compressor state.

### Backend Implementation (`rayuela-NodeBackend`)
- **Location:** `CheckinService.optimizeImage()` (`src/module/checkin/checkin.service.ts`).
- **Mechanism:**
  ```typescript
  private async optimizeImage(file: Express.Multer.File): Promise<Buffer> {
    try {
      return await sharp(file.buffer)
        .rotate() // Automatically orient based on EXIF orientation tag
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside', // Proportional scaling, does not crop
          withoutEnlargement: true, // Never upscale images smaller than 1600px
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (error) {
      this.logger.warn(`Failed to optimize image ${file.originalname}, falling back to raw buffer: ${error.message}`);
      return file.buffer; // Fail-open fallback
    }
  }
  ```
- Before pushing to Garage S3 (`this.s3Service.upload`), each uploaded file is passed through `optimizeImage()`. If `sharp` encounters an unsupported format or error, the raw `file.buffer` is uploaded without failing the HTTP request.

---

## 5. Technical Specifications

| Parameter | Value | Rationale |
| :--- | :--- | :--- |
| **Max Dimension** | `1600 px` (bounding box) | Standard 1080p–2K display sweet spot; preserves fine specimen features without mega-pixel bloat. |
| **Fit Mode** | `inside` (`withoutEnlargement: true`) | Preserves original aspect ratio; avoids blurry upscaling for low-resolution cameras. |
| **Format** | `JPEG` (`image/jpeg`) | Universal compatibility across web browsers, mobile platforms, and ML training pipelines. |
| **Quality** | `80%` | Perceptually lossless compression; eliminates 80–90% of file weight with no visible artifacts. |
| **Orientation** | `rotate()` (EXIF auto-orient) | Normalizes camera rotation tags so images never render sideways or upside-down. |
