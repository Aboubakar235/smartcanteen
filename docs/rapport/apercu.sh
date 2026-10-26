#!/bin/sh
# Convertit les pages d'un PDF en PNG pour les comparer à l'œil : apercu.sh fichier.pdf dossier
osascript -l JavaScript - "$1" "$2" <<'JS'
ObjC.import('PDFKit'); ObjC.import('AppKit');
function run(argv) {
  const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(argv[0]));
  for (let i = 0; i < doc.pageCount; i++) {
    const img = doc.pageAtIndex(i).thumbnailOfSizeForBox($.NSMakeSize(1100, 1556), $.kPDFDisplayBoxMediaBox);
    $.NSBitmapImageRep.imageRepWithData(img.TIFFRepresentation)
      .representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $())
      .writeToFileAtomically(argv[1] + '/p' + (i + 1) + '.png', true);
  }
  return doc.pageCount + ' page(s)';
}
JS
