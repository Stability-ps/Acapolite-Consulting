import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

window.scrollTo = () => {};

// jsdom 20's Blob/File implementation doesn't include text()/arrayBuffer()
// (added to jsdom in a later major) - clientImport.test.ts (PR8) exercises
// parseImportFile() against real File objects, which needs both. FileReader
// is fully supported here, so it's the polyfill base rather than reaching
// for fetch's Response (not guaranteed present in this environment).
function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

if (typeof Blob.prototype.text !== "function") {
  Blob.prototype.text = function (this: Blob) {
    return blobToText(this);
  };
}
if (typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function (this: Blob) {
    return blobToArrayBuffer(this);
  };
}
