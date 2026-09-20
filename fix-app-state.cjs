const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  "  const [mergedConnections,\n        topic,\n        questionToc,\n        claimVerifications, setMergedConnections] = useState<MergedConnection[]>([]);",
  "  const [mergedConnections, setMergedConnections] = useState<MergedConnection[]>([]);"
);

fs.writeFileSync('App.tsx', code);
