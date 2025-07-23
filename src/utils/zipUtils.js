import JSZip from 'jszip';

// Loads a JSZip instance from a file (Blob, File, or ArrayBuffer)
export async function loadZip(file) {
  return await JSZip.loadAsync(file);
}
