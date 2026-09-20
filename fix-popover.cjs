const fs = require('fs');
let code = fs.readFileSync('components/DocumentViewer.tsx', 'utf8');

const regex = /\{\/\* Selection Popover \*\/\}(.|\n)*?<\/div>\s*\)\s*\}/m;

const replacement = `{/* Selection Popover */}
      {selectionRect && selectedRange && !isAudioMode && (
        <div 
          className="absolute z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-lg p-2 flex gap-2 animate-fade-in-up items-center"
          style={{ top: selectionRect.top - 50, left: Math.max(0, selectionRect.left) }}
        >
          {COLORS.map(c => (
            <button 
              key={c} 
              className={\`w-6 h-6 rounded-full border border-slate-300 dark:border-slate-600 \${c.split(' ')[0]} dark:\${c.split(' ')[1]}\`}
              onClick={() => handleApplyHighlight(c)}
              title="Highlight"
            />
          ))}
          {onArgueCounterposition && (
            <button
              onClick={() => {
                onArgueCounterposition(selectedRange.text);
                window.getSelection()?.removeAllRanges();
                setSelectionRect(null);
                setSelectedRange(null);
              }}
              className="ml-2 px-2 py-1 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded hover:bg-red-200 flex items-center gap-1"
              title="Argue against this"
            >
              <ShieldAlert size={12} /> Disagree
            </button>
          )}
          {onVerifyClaim && (
            <button
              onClick={() => {
                onVerifyClaim(selectedRange.text);
                window.getSelection()?.removeAllRanges();
                setSelectionRect(null);
                setSelectedRange(null);
              }}
              className="px-2 py-1 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded hover:bg-blue-200 flex items-center gap-1"
              title="Verify this claim"
            >
              <FileSearch size={12} /> Verify
            </button>
          )}
        </div>
      )}`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('components/DocumentViewer.tsx', code);
  console.log("Replaced");
} else {
  console.log("No match");
}
