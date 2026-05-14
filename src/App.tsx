import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, Music, Sparkles, AudioWaveform, Wand2, Download, RefreshCw, Activity, Cpu, User } from 'lucide-react';

type ProcessState = 'idle' | 'analyzing' | 'forging' | 'complete';

export default function App() {
  const [appState, setAppState] = useState<ProcessState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [phrase, setPhrase] = useState("分析AI音频特征...");
  const [progress, setProgress] = useState(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('audio/')) {
      startProcess(droppedFile);
    } else {
      alert('请拖入有效的音频文件 (MP3, WAV, FLAC, M4A)');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      startProcess(e.target.files[0]);
    }
  };

  const startProcess = async (selectedFile: File) => {
    if (selectedFile.size > 200 * 1024 * 1024) {
      alert("文件过大！支持的最大文件大小为 200MB。");
      return;
    }

    setFile(selectedFile);
    setAppState('analyzing');
    setPhrase("解析核心数据...");
    setProgress(0);
    setResultBlob(null);

    try {
      const { processAudio } = await import('./lib/audioProcess');
      
      const wavBlob = await processAudio(selectedFile, (p, statusMsg) => {
         setProgress(p);
         setPhrase(statusMsg);
         setAppState((prev) => (prev === 'analyzing' && p > 30) ? 'forging' : prev);
      });
      
      setResultBlob(wavBlob);
      setAppState('complete');
      setPhrase("转化完成");
      setProgress(100);

    } catch (e: any) {
      console.error(e);
      setAppState('idle');
      alert(`处理失败: ${e.message || '请尝试其他文件或刷新页面。'}`);
      setFile(null);
      setProgress(0);
    }
  };

  const overrideDownload = () => {
    if (!file || !resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `[SoulForged]_${file.name.replace(/\.[^/.]+$/, "")}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetProcess = () => {
    setAppState('idle');
    setFile(null);
    setResultBlob(null);
    setProgress(0);
    setPhrase("等待输入...");
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Calculate stats based on progress
  let overallProgress = 0;
  if (appState === 'idle') {
    overallProgress = 0;
  } else if (appState === 'analyzing') {
    overallProgress = progress / 3;
  } else if (appState === 'forging') {
    overallProgress = 33.33 + (progress * 2 / 3);
  } else if (appState === 'complete') {
    overallProgress = 100;
  }

  const aiProb = appState === 'idle' ? null : Math.max(2, 98 - (overallProgress * 0.96));
  const humanProb = appState === 'idle' ? null : Math.min(98, 2 + (overallProgress * 0.96));

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="atmosphere" />
      
      {/* Magical Particles Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 6 + 2 + 'px',
              height: Math.random() * 6 + 2 + 'px',
              background: Math.random() > 0.5 ? 'rgba(168, 85, 247, 0.6)' : 'rgba(59, 130, 246, 0.6)',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              boxShadow: '0 0 10px 2px rgba(168, 85, 247, 0.4)'
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0.2, 1, 0.2],
            }}
            transition={{
              duration: Math.random() * 5 + 5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      <div className="z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        
        {/* Main Interface */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center justify-center w-full"
        >
          <div className="text-center mb-10">
            <motion.div 
              className="inline-flex items-center justify-center p-4 rounded-full glass-panel mb-6"
              animate={{ boxShadow: ['0 0 20px rgba(168, 85, 247, 0.2)', '0 0 40px rgba(168, 85, 247, 0.5)', '0 0 20px rgba(168, 85, 247, 0.2)'] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Sparkles className="w-10 h-10 text-purple-400" />
            </motion.div>
            <h1 className="text-5xl md:text-6xl font-serif glow-text text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-white to-blue-200 mb-4">
              SoulForge
            </h1>
            <p className="text-lg text-purple-200/70 font-light tracking-wide max-w-lg mx-auto">
              将AI生成的音频转化为纯粹的人类共鸣。
            </p>
          </div>

          <div className="glass-panel w-full max-w-2xl rounded-3xl p-8 relative overflow-hidden group">
            <AnimatePresence mode="wait">
              {appState === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="flex flex-col items-center justify-center py-12"
                >
                  <div 
                    className="w-full border-2 border-dashed border-purple-500/30 rounded-2xl p-12 text-center transition-all hover:bg-purple-500/5 hover:border-purple-400/50 cursor-pointer"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      accept="audio/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                    />
                    <div className="bg-purple-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                      <UploadCloud className="w-10 h-10 text-purple-400" />
                    </div>
                    <h3 className="text-2xl font-serif mb-2 text-white/90">拖拽AI生成的音频到此</h3>
                    <p className="text-white/50 text-sm font-light">支持 MP3, WAV, FLAC, M4A 格式</p>
                  </div>
                </motion.div>
              )}

              {(appState === 'analyzing' || appState === 'forging') && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-16 flex flex-col items-center"
                >
                  <div className="relative w-48 h-48 mb-10 flex items-center justify-center">
                    <motion.div 
                      className="absolute inset-0 border-2 border-purple-500/20 rounded-full"
                      animate={{ rotate: 360, scale: [1, 1.05, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div 
                      className="absolute inset-4 border border-blue-400/30 rounded-full border-dashed"
                      animate={{ rotate: -360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div 
                      className="absolute inset-8 border border-pink-400/20 rounded-full"
                      animate={{ rotate: 180, scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    {appState === 'analyzing' ? (
                      <AudioWaveform className="w-12 h-12 text-blue-300" />
                    ) : (
                      <Wand2 className="w-12 h-12 text-purple-300" />
                    )}
                  </div>

                  <div className="w-full max-w-md">
                    <div className="flex justify-between items-end mb-2">
                    <AnimatePresence mode="wait">
                      <motion.span 
                        key={phrase}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-sm font-medium text-purple-200"
                      >
                        {phrase}
                      </motion.span>
                    </AnimatePresence>
                      <span className="text-xs font-mono text-purple-300/50">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {file && (
                      <p className="mt-4 text-center text-xs text-white/30 truncate">
                        正在处理: {file.name}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {appState === 'complete' && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-8 flex flex-col items-center text-center"
                >
                  <motion.div 
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400/20 to-emerald-600/20 border border-green-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                  >
                    <Music className="w-8 h-8 text-emerald-300" />
                  </motion.div>
                  
                  <h2 className="text-3xl font-serif text-white mb-2">转化完成</h2>
                  <p className="text-white/60 font-light mb-8 max-w-sm">
                    人工合成痕迹已被清除，现在它拥有了真实的人类情感与声学共鸣。
                  </p>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-sm mb-8 space-y-4">
                    <h4 className="text-xs text-white/50 tracking-widest uppercase mb-2">深度检测模拟结果</h4>
                    
                    <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-pink-500/10">
                      <div className="flex items-center gap-2">
                         <User className="w-4 h-4 text-pink-400" />
                         <span className="text-sm text-pink-200">人类特征</span>
                      </div>
                      <span className="font-mono text-xl text-pink-400 tracking-wider">
                        {(92 + Math.random() * 6).toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-blue-500/10">
                      <div className="flex items-center gap-2">
                         <Cpu className="w-4 h-4 text-blue-400" />
                         <span className="text-sm text-blue-200">AI痕迹残留</span>
                      </div>
                      <span className="font-mono text-xl text-blue-400 tracking-wider">
                        {(1 + Math.random() * 5).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                    <button 
                      onClick={overrideDownload}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-8 py-3 rounded-full font-medium transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] hover:-translate-y-1"
                    >
                      <Download className="w-5 h-5" />
                      下载人类纯享版
                    </button>
                    <button 
                      onClick={resetProcess}
                      className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-8 py-3 rounded-full font-medium transition-all hover:border-white/30"
                    >
                      <RefreshCw className="w-5 h-5" />
                      转换另一首
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="mt-8 text-center text-xs text-white/20 uppercase tracking-widest">
            由算法炼金术驱动 (Powered by Algorithmic Alchemy)
          </div>
        </motion.div>

        {/* Side Panel (Analysis Stats) */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex flex-col h-full w-full max-w-md mx-auto"
        >
          <div className="glass-panel p-6 rounded-3xl flex-1 flex flex-col relative overflow-hidden">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Activity className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="font-serif text-xl tracking-wide text-white/90">属性数据分析</h3>
            </div>

            <div className="space-y-8 flex-1 flex flex-col justify-center">
              {/* AI Probability */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-2 text-blue-300">
                    <Cpu className="w-4 h-4" />
                    <span className="text-sm font-medium">AI 痕迹概率</span>
                  </div>
                  <span className="text-2xl font-mono text-blue-200">
                    {aiProb !== null ? `${aiProb.toFixed(1)}%` : '--%'}
                  </span>
                </div>
                <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-blue-500/20">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: aiProb !== null ? `${aiProb}%` : '0%' }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>

              {/* Human Probability */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-2 text-pink-300">
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium">人类情感概率</span>
                  </div>
                  <span className="text-2xl font-mono text-pink-200">
                    {humanProb !== null ? `${humanProb.toFixed(1)}%` : '--%'}
                  </span>
                </div>
                <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-pink-500/20">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-pink-600 to-rose-400 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: humanProb !== null ? `${humanProb}%` : '0%' }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
              
              {/* Visual Decorative element */}
              <div className="mt-8 pt-8 border-t border-white/5 text-xs text-white/40 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span>STATUS</span>
                  <span className={appState === 'complete' ? 'text-green-400' : 'text-purple-400'}>
                    {appState === 'idle' ? 'AWAITING_INPUT' : appState === 'analyzing' ? 'ANALYZING_CORE' : appState === 'forging' ? 'RESTRUCTURING' : 'OPTIMIZED'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>RESONANCE</span>
                  <span>{humanProb !== null ? `${(humanProb * 0.8).toFixed(1)} Hz` : '0.0 Hz'}</span>
                </div>
                <div className="flex justify-between">
                  <span>SYNTHETIC_CROP</span>
                  <span>{aiProb !== null ? `-${(98 - aiProb).toFixed(1)} dB` : '0.0 dB'}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
