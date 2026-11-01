# WearOn sample collection

The original twelve images were generated specifically for WearOn on 2026-10-22. The full-outfit reference
was generated on 2026-10-27 as a coordinated terracotta shirt and charcoal trousers look. These are
fictional, unbranded demonstration garments; they are not purchasable inventory, fabric specifications, or
sizing references.

## Format

All thirteen files are **WebP at 1122×1402**, the exact size the storefront renders them at.

They were previously committed as PNG. Photographic content is a poor fit for PNG — the directory weighed
**26.85 MB**. Converted to WebP at quality 88 the same directory is **1.77 MB**, a 15× reduction, measured
at a minimum of 40.1 dB PSNR against the originals. No resizing was performed: the source images already
matched the display size, so only the container changed.

If you add a garment, export it at 1122×1402 WebP rather than PNG:

```bash
python -c "from PIL import Image; im=Image.open('new-piece.png').convert('RGB'); im.save('new-piece.webp','WEBP',quality=88,method=6)"
```

