import React from 'react';
import { BookOpenText, Sparkles } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  light?: boolean;
  animated?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size = 'md', light = false, animated = false }) => {
  const sizeClasses = {
    sm: { icon: 18, text: 'text-lg', container: 'p-1.5' },
    md: { icon: 24, text: 'text-xl', container: 'p-2' },
    lg: { icon: 32, text: 'text-3xl', container: 'p-3' },
    xl: { icon: 48, text: 'text-5xl', container: 'p-4' },
  };

  const currentSize = sizeClasses[size];
  const textColor = light ? 'text-white' : 'text-slate-800';
  const iconColor = light ? 'text-indigo-100' : 'text-white';
  const gradient = 'bg-gradient-to-br from-indigo-500 to-purple-600';

  return (
    <div className="flex items-center gap-3 select-none">
      <div className={`
        relative rounded-2xl shadow-lg flex items-center justify-center ${gradient} ${currentSize.container}
        ${animated ? 'animate-bounce-subtle' : ''}
      `}>
        <BookOpenText size={currentSize.icon} className={iconColor} strokeWidth={2} />
        <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
            <Sparkles size={currentSize.icon * 0.5} className="text-amber-400 fill-amber-400" />
        </div>
      </div>
      
      <div className="flex flex-col">
        <h1 className={`font-display font-semibold tracking-tight leading-none ${currentSize.text} ${textColor}`}>
          mynarrator
        </h1>
      </div>
    </div>
  );
};

export default Logo;