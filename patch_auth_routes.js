const fs = require('fs');
const file = '/home/nebiyu/Desktop/Growth circle/ERP/server/src/routes/auth.ts';
let code = fs.readFileSync(file, 'utf8');

// Modify the login route
code = code.replace(
  `include: { branch: { select: { id: true, name: true } } },`,
  `include: { branch: { select: { id: true, name: true, isActive: true } } },`
);

code = code.replace(
  `  if (!user) {\n    return res.status(401).json({ error: 'Invalid credentials' });\n  }`,
  `  if (!user) {\n    return res.status(401).json({ error: 'Invalid credentials' });\n  }\n\n  if (user.branch && !user.branch.isActive) {\n    return res.status(403).json({\n      error: 'Log in denied: Your assigned branch is currently inactive.',\n    });\n  }`
);

// Modify the /me route to select additional fields
code = code.replace(
  `      branchId: true,\n      branch: { select: { id: true, name: true } },`,
  `      branchId: true,\n      branch: { select: { id: true, name: true } },\n      filesUrl: true,\n      shift: true,\n      salary: true,\n      startDate: true,\n      isActive: true,`
);

// Add the /password PATCH endpoint
const passwordEndpoint = `
authRouter.patch('/password', authMiddleware, async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Incorrect current password' });
  }
  
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { passwordHash },
  });
  
  res.json({ message: 'Password updated successfully' });
});
`;

code = code.replace(`export const authRouter = Router();`, `export const authRouter = Router();\n${passwordEndpoint}`);

fs.writeFileSync(file, code);
