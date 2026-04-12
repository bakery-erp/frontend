const fs = require('fs');
const file = '/home/nebiyu/Desktop/Growth circle/ERP/client/src/app/branches/page.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /\<Dialog open=\{isDialogOpen\} onOpenChange=\{setIsDialogOpen\}\>\s+\<Button onClick=\{\(\) \=\> handleOpenDialog\(\)\} className="flex items-center gap-2"\>\s+\<Plus className="w-4 h-4" \/\>\s+Add Branch\s+\<\/Button\>/,
  `<Button onClick={() => handleOpenDialog()} className="flex items-center gap-2">\n            <Plus className="w-4 h-4" />\n            Add Branch\n          </Button>\n\n          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>`
);
fs.writeFileSync(file, content);
