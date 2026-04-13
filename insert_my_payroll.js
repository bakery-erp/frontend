const fs = require('fs');

const path = '/home/nebiyu/Desktop/Growth circle/ERP/server/src/routes/payroll.ts';
let content = fs.readFileSync(path, 'utf8');

const anchor = 'payrollRouter.use(authMiddleware);';

const newEndpoint = `
payrollRouter.get('/my', async (req: any, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const list = await prisma.payrollRecord.findMany({
    where: { userId },
    include: { user: { select: { id: true, fullName: true, phone: true, role: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
  res.json(list);
});
`;

if (!content.includes('/my')) {
  content = content.replace(anchor, anchor + '\n' + newEndpoint);
  fs.writeFileSync(path, content);
  console.log('Inserted /my endpoint');
} else {
  console.log('/my endpoint already exists');
}
