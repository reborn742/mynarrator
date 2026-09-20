import React, { useEffect, useState } from 'react';
import Logo from './Logo';

interface IntroAnimationProps {
  onComplete: () => void;
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Stage 0: Initial Render (0ms)
    
    // Stage 1: Logo Fade In (100ms)
    const t1 = setTimeout(() => setStage(1), 100);

    // Stage 2: Slide Up / Fade Out (2500ms)
    const t2 = setTimeout(() => setStage(2), 2500);

    // Stage 3: Complete (3000ms)
    const t3 = setTimeout(() => onComplete(), 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  if (stage === 3) return null;

  return (
    <div 
      className={`
        fixed inset-0 z-[100] flex items-center justify-center bg-slate-50 dark:bg-slate-950
        transition-all duration-700 ease-[cubic-bezier(0.76,0,0.24,1)]
        ${stage === 2 ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}
      `}
    >
      <div 
        className={`
          flex flex-col items-center gap-6 transition-all duration-1000 transform
          ${stage >= 1 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}
        `}
      >
        <Logo size="xl" animated={true} />
        
        <div className="flex flex-col items-center gap-2 mt-4">
            <div className="h-1 w-24 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"></div>
            <p className="text-slate-400 dark:text-slate-500 text-sm font-medium tracking-widest uppercase mt-2">
                AI Reading Assistant
            </p>
        </div>
      </div>
    </div>
  );
};

export default IntroAnimation;