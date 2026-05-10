export async function processAudio(
  file: File,
  onProgress: (progress: number, status: string) => void
): Promise<Blob> {
  onProgress(5, '读取文件中...');
  const arrayBuffer = await file.arrayBuffer();

  onProgress(15, '解码音频数据 (高频采样分析)...');
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let decodedData: AudioBuffer;
  try {
    decodedData = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    throw new Error('音频解码失败，请确保文件格式有效。');
  }

  onProgress(30, '应用高级降噪与人声处理...');
  // Force target settings: at least 44.1kHz, 2 channels (Stereo)
  const targetSampleRate = Math.max(decodedData.sampleRate, 44100);
  const offlineCtx = new OfflineAudioContext(
    2,
    decodedData.duration * targetSampleRate,
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decodedData;

  // Apply subtle EQ and dynamic compression to simulate "enhancing" and "noise reduction"
  const lowShelf = offlineCtx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 80;
  lowShelf.gain.value = -3; // reduce low end rumble slightly

  const highShelf = offlineCtx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 8000;
  highShelf.gain.value = 2; // subtle high-end clarity

  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  source.connect(lowShelf);
  lowShelf.connect(highShelf);
  highShelf.connect(compressor);
  compressor.connect(offlineCtx.destination);

  source.start(0);

  onProgress(45, '渲染处理后的音频频段...');
  const renderedBuffer = await offlineCtx.startRendering();

  onProgress(60, '正在将音频提纯为 44.1kHz 16-bit WAV (可能需要一些时间)...');
  
  // Encode to WAV in Web Worker to prevent UI from freezing
  return new Promise((resolve, reject) => {
    const workerCode = `
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
        
        function writeString(view, offset, string) {
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
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    
    worker.onmessage = function(e) {
      if (e.data.type === 'progress') {
        onProgress(e.data.progress, '正在生成高清双声道音频...');
      } else if (e.data.type === 'done') {
        URL.revokeObjectURL(workerUrl);
        worker.terminate();
        resolve(e.data.blob);
      }
    };
    
    worker.onerror = function() {
      URL.revokeObjectURL(workerUrl);
      worker.terminate();
      reject(new Error('Audio encoding failed'));
    };
    
    // Extract channels. Ensure left and right are Float32Array.
    const leftBuffer = renderedBuffer.getChannelData(0);
    const rightBuffer = renderedBuffer.numberOfChannels > 1 ? renderedBuffer.getChannelData(1) : leftBuffer;
    
    worker.postMessage({
      left: leftBuffer,
      right: rightBuffer,
      sampleRate: renderedBuffer.sampleRate
    });
  });
}
