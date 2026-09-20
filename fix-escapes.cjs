const fs = require('fs');

['components/DocumentViewer.tsx', 'components/Sidebar.tsx', 'App.tsx'].forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/\\`/g, '`');
  code = code.replace(/\\\$/g, '$');
  code = code.replace(/\\\\n/g, '\\n');
  fs.writeFileSync(file, code);
});
