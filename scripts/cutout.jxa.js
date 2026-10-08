// Lifts the subject out of a photograph and writes it as a PNG with transparency.
//
// Same Vision segmentation the Finder's "Remove Background" uses, reached through the
// JavaScript-to-ObjC bridge that ships with macOS, because the Swift toolchain on this
// machine has a broken SDK and there is nothing to install this way.
//
// usage: osascript -l JavaScript cutout.jxa.js <input> <output.png>

ObjC.import('Foundation');
ObjC.import('AppKit');
ObjC.import('Vision');
ObjC.import('Quartz');

// `run` is the entry point osascript calls; nothing in this file calls it.
// eslint-disable-next-line no-unused-vars
function run(argv) {
  if (argv.length !== 2) throw new Error('usage: cutout.jxa.js <input> <output.png>');

  const inURL = $.NSURL.fileURLWithPath($(argv[0]).stringByExpandingTildeInPath);
  const outPath = $(argv[1]).stringByExpandingTildeInPath;

  const handler = $.VNImageRequestHandler.alloc.initWithURLOptions(inURL, $());
  const request = $.VNGenerateForegroundInstanceMaskRequest.alloc.init;

  const err = Ref();
  if (!handler.performRequestsError($([request]), err)) {
    throw new Error('vision failed: ' + err[0].localizedDescription.js);
  }

  const results = request.results;
  if (!results || results.count === 0) throw new Error('no subject found');
  const obs = results.objectAtIndex(0);

  // The whole frame, not cropped to the subject: the two poses have to stay registered with
  // each other so one can dissolve into the other without the figure jumping.
  const err2 = Ref();
  const buffer = obs.generateMaskedImageOfInstancesFromRequestHandlerCroppedToInstancesExtentError(
    obs.allInstances,
    handler,
    false,
    err2,
  );
  if (!buffer) throw new Error('masking failed: ' + err2[0].localizedDescription.js);

  const ci = $.CIImage.imageWithCVImageBuffer(buffer);
  const rep = $.NSCIImageRep.imageRepWithCIImage(ci);
  const image = $.NSImage.alloc.initWithSize(rep.size);
  image.addRepresentation(rep);

  // Round-tripping through TIFF keeps the alpha channel; going straight to PNG from the
  // CIImage needs CoreImage format constants the bridge does not expose.
  const bitmap = $.NSBitmapImageRep.imageRepWithData(image.TIFFRepresentation);
  const png = bitmap.representationUsingTypeProperties(4 /* NSBitmapImageFileTypePNG */, $());
  if (!png.writeToFileAtomically(outPath, true)) throw new Error('could not write ' + argv[1]);

  return `${argv[1]}: ${rep.size.width}x${rep.size.height}, ${Math.round(png.length / 1024)} KB, ${obs.allInstances.count} instance(s)`;
}
