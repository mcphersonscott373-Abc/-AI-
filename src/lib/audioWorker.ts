self.onmessage = function(e) {
  const left = e.data.left;
  const right = e.data.right;
  const sampleRate = e.data.sampleRate;
  const numChannels = right ? 2 : 1;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const length = left.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const bufferLength = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
  
  // Write WAV Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  let offset = 44;
  
  // Use batch processing to avoid hanging the worker and blocking message loop
  let i = 0;
  const batchSize = Math.max(10000, Math.floor(length / 100));
  
  function processBatch() {
    const end = Math.min(i + batchSize, length);
    for (; i < end; i++) {
      let sl = Math.max(-1, Math.min(1, left[i]));
      sl = sl < 0 ? sl * 0x8000 : sl * 0x7FFF;
      view.setInt16(offset, sl, true);
      offset += 2;
      
      if (right) {
        let sr = Math.max(-1, Math.min(1, right[i]));
        sr = sr < 0 ? sr * 0x8000 : sr * 0x7FFF;
        view.setInt16(offset, sr, true);
        offset += 2;
      }
    }
    
    self.postMessage({ type: 'progress', progress: 60 + (i / length) * 40 });
    
    if (i < length) {
      setTimeout(processBatch, 0); // yield
    } else {
      const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
      self.postMessage({ type: 'done', blob: blob });
    }
  }
  
  processBatch();
};
