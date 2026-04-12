const fs = require('fs');
const file = '/home/nebiyu/Desktop/Growth circle/ERP/client/src/context/AuthContext.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `  branch?: {\n    id: string;\n    name: string;\n  };\n}`,
  `  branch?: {\n    id: string;\n    name: string;\n  };\n  filesUrl?: string | null;\n  shift?: string | null;\n  salary?: number | null;\n  startDate?: string | null;\n  isActive?: boolean;\n}`
);

fs.writeFileSync(file, code);
