These are synthetic images, not student documents. Both contain the same Swedish biology sentences used in `scanFixture` in the browser tests, drawn in 32px Arial on a white 1200 × 1600 canvas.

`swedish-scan.jp2` is a lossless JPEG 2000 image. `swedish-scan.ccitt` is a single Group 4 CCITT strip extracted from a monochrome TIFF. They were generated with Pillow (`Image.save(format='JPEG2000', irreversible=False)` and `Image.convert('1', dither=Image.Dither.NONE).save(format='TIFF', compression='group4', strip_size=1000000)`). The PDF fixture embeds them with `JPXDecode` or `CCITTFaxDecode` respectively.

These formats require the PDF.js image decoders; ordinary JPEG scans do not exercise those decoders. Tests read the committed image bytes, so Pillow is not required to run the test suite.
