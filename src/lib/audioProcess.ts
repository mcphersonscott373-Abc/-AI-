import AudioWorker from './audioWorker?worker';

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
    decodedData = await new Promise<AudioBuffer>((resolve, reject) => {
      try {
        const promise = audioCtx.decodeAudioData(
          arrayBuffer,
          (buffer: AudioBuffer) => resolve(buffer),
          (err: any) => reject(new Error('解码由于回调失败'))
        );
        if (promise) {
          promise.catch(reject);
        }
      } catch (e) {
        reject(e);
      }
    });
  } catch (err) {
    throw new Error('音频解码失败，如果是在封装应用内，可能是因为权限或非标准系统环境限制，请确保文件格式为常规音频。');
  }

  onProgress(30, '注入深度声学偏差与流体动态时间轴 (Deep Temporal Jitter)...');
  
  // Target 44.1kHz or higher, always stereo
  const targetSampleRate = Math.max(decodedData.sampleRate, 44100);
  const OAC = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const offlineCtx = new OAC(
    2,
    decodedData.duration * targetSampleRate,
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decodedData;

  // --- 1. Authentic Wow & Flutter (Random Walk Tape Drift) ---
  // A truly unpredictable, continuous micro-fluctuation in pitch and time.
  const driftBufferSize = targetSampleRate * 10; // 10 seconds of random walk
  const driftBuffer = offlineCtx.createBuffer(1, driftBufferSize, targetSampleRate);
  const driftData = driftBuffer.getChannelData(0);
  // generate smoothed brown noise for tape drift profile
  let currentVal = 0;
  for(let i = 0; i < driftBufferSize; i++) {
     currentVal += (Math.random() - 0.5) * 0.01;
     currentVal *= 0.999; // leak to keep bounded
     driftData[i] = currentVal;
  }
  const driftSource = offlineCtx.createBufferSource();
  driftSource.buffer = driftBuffer;
  driftSource.loop = true;

  const driftGain = offlineCtx.createGain();
  driftGain.gain.value = 0.002; // Very subtle continuous pitch variation (+/- 0.2%)
  driftSource.connect(driftGain);
  driftGain.connect(source.playbackRate);

  // --- 2. Multi-Band Phase Decorrelation ---
  // Split frequencies to apply different micro-delays, scrambling AI generated alignment
  const lowPass = offlineCtx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 300;
  
  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 300;
  
  source.connect(lowPass);
  source.connect(highPass);

  // Apply subtle latency only to the highs (mimics multi-mic bleed and air distance)
  const highDelay = offlineCtx.createDelay(0.1);
  highDelay.delayTime.value = 0.0021; // 2.1ms delay on highs
  highPass.connect(highDelay);

  // Recombine
  const bandMerger = offlineCtx.createGain();
  lowPass.connect(bandMerger);
  highDelay.connect(bandMerger);

  // --- 3. Reactive Harmonic Exciters (Saturation via Tape Emulation) ---
  // Asymmetrical distortion breaks the mathematically perfect mirrored waveforms of AI
  const waveShaper = offlineCtx.createWaveShaper();
  waveShaper.curve = (function makeDistortionCurve(amount) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      // Asymmetric squaring adds even & odd harmonics
      const xOffset = x + 0.05; 
      curve[i] = ((3 + k) * Math.sin(xOffset) * 20 * deg) / (Math.PI + k * Math.abs(xOffset)) - 0.05;
    }
    return curve;
  })(4); // Organic distortion
  waveShaper.oversample = '4x';
  
  bandMerger.connect(waveShaper);

  // --- 4. Acoustic Room Reverb (Impulse Re-seeding) ---
  // Re-encode a micro-room environment to mask digital artifacts with "air"
  const earlyReflections = offlineCtx.createGain();
  earlyReflections.gain.value = 0.15; // 15% wet
  
  const delayTaps = [0.007, 0.012, 0.021, 0.033, 0.045];
  delayTaps.forEach((time, index) => {
    const tap = offlineCtx.createDelay(0.1);
    tap.delayTime.value = time;
    const tapGain = offlineCtx.createGain();
    tapGain.gain.value = Math.pow(0.6, index + 1);
    
    const tapFilter = offlineCtx.createBiquadFilter();
    tapFilter.type = 'lowpass';
    tapFilter.frequency.value = 8000 - (index * 1000); // Progressively darker reflections
    
    waveShaper.connect(tap);
    tap.connect(tapFilter);
    tapFilter.connect(tapGain);
    tapGain.connect(earlyReflections);
  });

  // --- 5. Studio Equipment Artifact Layer (Hum & Hiss) ---
  // Induce a 50Hz/60Hz AC mains hum alongside equipment thermal noise
  const acHum = offlineCtx.createOscillator();
  acHum.type = 'sine';
  acHum.frequency.value = 60; // 60Hz hum
  const humGain = offlineCtx.createGain();
  humGain.gain.value = 0.0001; // barely audible, but fools FFT analysis

  const noiseSource = offlineCtx.createBufferSource();
  const bufferSize = decodedData.duration * targetSampleRate;
  const pinkBuffer = offlineCtx.createBuffer(2, bufferSize, targetSampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const output = pinkBuffer.getChannelData(channel);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
        
        // Sprinkle tiny crackles simulating vinyl/mic pops
        if (Math.random() < 0.00002) {
          output[i] += (Math.random() - 0.5) * 5.0; // Random spike
        }
    }
  }
  noiseSource.buffer = pinkBuffer;

  const noiseFilter = offlineCtx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 400; 
  
  const noiseGain = offlineCtx.createGain();
  noiseGain.gain.value = 0.0015;

  acHum.connect(humGain);
  noiseSource.connect(noiseFilter).connect(noiseGain);

  // --- 6. Final Bus Compressor (Analog Glue) ---
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -15;
  compressor.knee.value = 35; 
  compressor.ratio.value = 3; 
  compressor.attack.value = 0.02; 
  compressor.release.value = 0.2; 

  waveShaper.connect(compressor);
  earlyReflections.connect(compressor);
  humGain.connect(compressor);
  noiseGain.connect(compressor);

  const finalOutputGain = offlineCtx.createGain();
  finalOutputGain.gain.value = 1.05; 

  compressor.connect(finalOutputGain);
  finalOutputGain.connect(offlineCtx.destination);

  // Start oscillators and sources
  driftSource.start(0);
  acHum.start(0);
  noiseSource.start(0);
  source.start(0);

  onProgress(45, '重组微观声学时间线及混沌声场...');
  const renderedBuffer = await offlineCtx.startRendering();

  onProgress(60, '正在将音频提纯为 44.1kHz 16-bit WAV (可能需要一些时间)...');
  
  // Encode to WAV in Web Worker to prevent UI from freezing
  return new Promise((resolve, reject) => {
    const worker = new AudioWorker();
    
    worker.onmessage = function(e) {
      if (e.data.type === 'progress') {
        onProgress(e.data.progress, '正在生成高清双声道音频...');
      } else if (e.data.type === 'done') {
        worker.terminate();
        resolve(e.data.blob);
      }
    };
    
    worker.onerror = function() {
      worker.terminate();
      reject(new Error('Audio encoding failed'));
    };
    
    // Extract channels and send as transferable to avoid structured clone bloat
    const leftChannelData = renderedBuffer.getChannelData(0);
    const leftBufferClone = new Float32Array(leftChannelData.length);
    leftBufferClone.set(leftChannelData);

    let rightBufferClone: Float32Array;
    if (renderedBuffer.numberOfChannels > 1) {
      const rightChannelData = renderedBuffer.getChannelData(1);
      rightBufferClone = new Float32Array(rightChannelData.length);
      rightBufferClone.set(rightChannelData);
    } else {
      rightBufferClone = new Float32Array(leftChannelData.length);
      rightBufferClone.set(leftChannelData);
    }
    
    worker.postMessage({
      left: leftBufferClone,
      right: rightBufferClone,
      sampleRate: renderedBuffer.sampleRate
    }, [leftBufferClone.buffer, rightBufferClone.buffer]);
  });
}
