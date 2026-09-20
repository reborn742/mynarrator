import React, { useState } from 'react';
import { Type, Sun, Moon, Check, Sparkles, BookOpen, Sliders, Eye } from 'lucide-react';

interface TypographySettingsProps {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  font: string;
  setFont: (f: string) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  lineSpacing: number;
  setLineSpacing: (s: number) => void;
}

interface FontOption {
  id: string;
  name: string;
  category: 'Serif' | 'Sans-serif' | 'Specialized';
  badge: string;
  description: string;
  sample: string;
}

const FONT_OPTIONS: FontOption[] = [
  // Serif (Books, Journals & Longform)
  {
    id: 'font-serif',
    name: 'Merriweather',
    category: 'Serif',
    badge: 'Screen Serif',
    description: 'Generous x-height engineered specifically for fatigue-free screen reading.',
    sample: 'The quick brown fox jumps over the lazy dog.',
  },
  {
    id: 'font-lora',
    name: 'Lora',
    category: 'Serif',
    badge: 'Editorial',
    description: 'Contemporary literary serif with graceful brushed curves, ideal for articles.',
    sample: 'Philosophy begins in wonder and blossoms into deep inquiry.',
  },
  {
    id: 'font-garamond',
    name: 'EB Garamond',
    category: 'Serif',
    badge: 'Classic Book',
    description: 'Timeless Renaissance typography mimicking the aesthetic of traditional printed books.',
    sample: 'Words carry the weight and cadence of centuries past.',
  },
  {
    id: 'font-literata',
    name: 'Literata',
    category: 'Serif',
    badge: 'E-Reader',
    description: 'Created for continuous digital publishing and long-form e-reader immersion.',
    sample: 'Every page invites thoughtful contemplation and quiet focus.',
  },

  // Sans-serif (Clean & Accessible)
  {
    id: 'font-sans',
    name: 'Inter',
    category: 'Sans-serif',
    badge: 'Clean UI',
    description: 'High-contrast neutral typeface designed for maximum computer screen legibility.',
    sample: 'Clear interfaces illuminate complex data with simplicity.',
  },
  {
    id: 'font-jakarta',
    name: 'Plus Jakarta Sans',
    category: 'Sans-serif',
    badge: 'Modern Sans',
    description: 'Fresh, geometric grotesque with wide apertures and warm proportions.',
    sample: 'Innovation and human-centric design move forward hand in hand.',
  },
  {
    id: 'font-atkinson',
    name: 'Atkinson Hyperlegible',
    category: 'Sans-serif',
    badge: 'High Legibility',
    description: 'Specially sculpted to differentiate ambiguous letters; dyslexia and low-vision friendly.',
    sample: 'Distinct letterforms ensure effortless recognition and flow.',
  },

  // Specialized (Technical & Display)
  {
    id: 'font-mono',
    name: 'JetBrains Mono',
    category: 'Specialized',
    badge: 'Monospace',
    description: 'Fixed-width character grid perfect for code snippets, logs, and technical reports.',
    sample: 'const knowledge = document.synthesize(); // 0x42',
  },
  {
    id: 'font-display',
    name: 'Playfair Display',
    category: 'Specialized',
    badge: 'Display Serif',
    description: 'High-contrast transitional serif reminiscent of fine 18th-century European print.',
    sample: 'Exquisite literary expression adorned with quiet majesty.',
  },
];

const TypographySettings: React.FC<TypographySettingsProps> = ({
  theme,
  setTheme,
  font,
  setFont,
  fontSize,
  setFontSize,
  lineSpacing,
  setLineSpacing,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Serif' | 'Sans-serif' | 'Specialized'>('All');

  const filteredFonts = selectedCategory === 'All'
    ? FONT_OPTIONS
    : FONT_OPTIONS.filter(f => f.category === selectedCategory);

  const selectedFontObj = FONT_OPTIONS.find(f => f.id === font) || FONT_OPTIONS[0];

  return (
    <div className="p-5 space-y-6">
      {/* Theme Selection */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Sun size={14} className="text-indigo-500" />
          Color Theme
        </h4>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
              theme === 'light'
                ? 'border-indigo-500 bg-indigo-50/80 text-indigo-700 shadow-sm dark:bg-indigo-950/40 dark:text-indigo-300'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Sun size={16} className={theme === 'light' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
            <span>Light Canvas</span>
            {theme === 'light' && <Check size={14} className="text-indigo-600 dark:text-indigo-400 ml-auto" />}
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
              theme === 'dark'
                ? 'border-indigo-500 bg-indigo-900/40 text-indigo-300 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Moon size={16} className={theme === 'dark' ? 'text-indigo-400' : 'text-slate-400'} />
            <span>Dark Twilight</span>
            {theme === 'dark' && <Check size={14} className="text-indigo-400 ml-auto" />}
          </button>
        </div>
      </div>

      {/* Font Family Selection */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Type size={14} className="text-indigo-500" />
            Font Family ({FONT_OPTIONS.length} Available)
          </h4>
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
            {selectedFontObj.name}
          </span>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-3 text-xs">
          {(['All', 'Serif', 'Sans-serif', 'Specialized'] as const).map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat === 'All' ? `All (${FONT_OPTIONS.length})` : cat}
            </button>
          ))}
        </div>

        {/* Font Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredFonts.map((f) => {
            const isSelected = font === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFont(f.id)}
                className={`flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-slate-900 dark:text-white shadow-xs ring-1 ring-indigo-500/40'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {/* Visual "Aa" Glyphs rendered in exact font */}
                <span
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-base font-semibold shrink-0 select-none ${f.id} ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  Aa
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-sm font-semibold truncate ${f.id}`}>
                      {f.name}
                    </span>
                    {isSelected && (
                      <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 ml-auto" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-block text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400">
                      {f.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1 leading-tight">
                    {f.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Font Size & Line Spacing */}
      <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders size={14} className="text-indigo-500" />
              Font Size
            </h4>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFontSize(Math.max(14, fontSize - 2))}
                className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="Decrease size"
              >
                -
              </button>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-semibold min-w-[42px] text-center">
                {fontSize}px
              </span>
              <button
                type="button"
                onClick={() => setFontSize(Math.min(48, fontSize + 2))}
                className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="Increase size"
              >
                +
              </button>
            </div>
          </div>
          <input
            type="range"
            min="14"
            max="44"
            step="1"
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            className="w-full accent-indigo-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            <span>Compact (14px)</span>
            <span>Standard (24px)</span>
            <span>Display (44px)</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Type size={14} className="text-indigo-500" />
              Line Spacing
            </h4>
            <div className="flex items-center gap-1">
              {[1.4, 1.7, 2.0].map((spacing) => (
                <button
                  key={spacing}
                  type="button"
                  onClick={() => setLineSpacing(spacing)}
                  className={`text-[11px] px-2 py-0.5 rounded font-medium border transition-all ${
                    Math.abs(lineSpacing - spacing) < 0.05
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {spacing === 1.4 ? 'Tight' : spacing === 1.7 ? 'Normal' : 'Relaxed'}
                </button>
              ))}
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 ml-1">
                {lineSpacing.toFixed(1)}x
              </span>
            </div>
          </div>
          <input
            type="range"
            min="1.2"
            max="2.4"
            step="0.1"
            value={lineSpacing}
            onChange={(e) => setLineSpacing(parseFloat(e.target.value))}
            className="w-full accent-indigo-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Live Sample Preview Box */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Eye size={14} className="text-indigo-500" />
          Live Reading Preview ({selectedFontObj.name})
        </h4>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
          <p
            className={`${font} text-slate-800 dark:text-slate-100 transition-all duration-200`}
            style={{ fontSize: `${Math.min(24, Math.max(15, fontSize))}px`, lineHeight: lineSpacing }}
          >
            {selectedFontObj.sample}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
            <span>Font: <strong className="text-slate-600 dark:text-slate-300 font-medium">{selectedFontObj.name}</strong></span>
            <span>Size: {fontSize}px &middot; Leading: {lineSpacing.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypographySettings;
