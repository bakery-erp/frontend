const fs = require('fs');
const file = '/home/nebiyu/Desktop/Growth circle/ERP/server/src/lib/authUser.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `export type AuthUserDto = {\n  id: string;\n  fullName: string;\n  phone: string | null;\n  role: Role;\n  branchId: string | null;\n  branch: { id: string; name: string } | null;\n};`,
  `export type AuthUserDto = {\n  id: string;\n  fullName: string;\n  phone: string | null;\n  role: Role;\n  branchId: string | null;\n  branch: { id: string; name: string } | null;\n  filesUrl?: string | null;\n  shift?: string | null;\n  salary?: any;\n  startDate?: Date | null;\n  isActive?: boolean;\n};`
);

code = code.replace(
  `type UserWithBranch = {\n  id: string;\n  fullName: string;\n  phone: string | null;\n  role: Role;\n  branchId: string | null;\n  branch: Pick<Branch, 'id' | 'name'> | null;\n};`,
  `type UserWithBranch = {\n  id: string;\n  fullName: string;\n  phone: string | null;\n  role: Role;\n  branchId: string | null;\n  branch: Pick<Branch, 'id' | 'name'> | null;\n  filesUrl?: string | null;\n  shift?: string | null;\n  salary?: any;\n  startDate?: Date | null;\n  isActive?: boolean;\n};`
);

code = code.replace(
  `    branchId: user.branchId,\n    branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,\n  };\n}`,
  `    branchId: user.branchId,\n    branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,\n    filesUrl: user.filesUrl,\n    shift: user.shift,\n    salary: user.salary,\n    startDate: user.startDate,\n    isActive: user.isActive,\n  };\n}`
);

fs.writeFileSync(file, code);
