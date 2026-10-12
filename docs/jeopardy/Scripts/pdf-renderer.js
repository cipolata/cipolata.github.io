import * as pdfjsLib from '../node_modules/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

var renderGeneration = 0;
var currentImageUrl = null;

window.cancelPdfPageRender = function () {
  renderGeneration++;
  if (currentImageUrl) {
    URL.revokeObjectURL(currentImageUrl);
    currentImageUrl = null;
  }
};

window.renderPdfPageAsImage = async function (pdfUrl, container) {
  var generation = ++renderGeneration;
  var pdf = await pdfjsLib.getDocument(pdfUrl).promise;
  try {
    var page = await pdf.getPage(1);
    var baseViewport = page.getViewport({ scale: 1 });
    var fitScale = Math.min(
      container.clientWidth / baseViewport.width,
      container.clientHeight / baseViewport.height
    );
    var scale = fitScale * Math.min(window.devicePixelRatio || 1, 2);
    var viewport = page.getViewport({ scale: scale });
    var canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    var context = canvas.getContext('2d');

    await page.render({ canvasContext: context, viewport: viewport }).promise;
    if (generation !== renderGeneration) {
      return;
    }

    var imageBlob = await new Promise(function (resolve) {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!imageBlob) {
      throw new Error('Could not create the PDF page image');
    }
    if (generation !== renderGeneration) {
      return;
    }

    if (currentImageUrl) {
      URL.revokeObjectURL(currentImageUrl);
    }
    currentImageUrl = URL.createObjectURL(imageBlob);
    var image = document.createElement('img');
    image.src = currentImageUrl;
    image.alt = 'First page of uploaded PDF';
    container.replaceChildren(image);
  } finally {
    await pdf.destroy();
  }
};