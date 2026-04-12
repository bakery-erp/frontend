const fs = require('fs');
const file = '/home/nebiyu/Desktop/Growth circle/ERP/client/src/app/branches/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add toggleLoading state
code = code.replace(
  'const [searchTerm, setSearchTerm] = useState("");',
  'const [searchTerm, setSearchTerm] = useState("");\n  const [toggleLoading, setToggleLoading] = useState<string | null>(null);'
);

// Update handleToggleStatus
code = code.replace(
  /const handleToggleStatus = async \(id: string, currentStatus: boolean\) => \{[\s\S]*?catch \(error\) \{[\s\S]*?toast.error\("Failed to update branch status."\);[\s\S]*?\}\n  \};/,
  `const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      setToggleLoading(id);
      await api.patch(\`/branches/\${id}\`, { isActive: !currentStatus });
      toast.success(currentStatus ? "Branch deactivated." : "Branch activated.");
      setBranches((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isActive: !currentStatus } : b))
      );
    } catch (error) {
      toast.error("Failed to update branch status.");
    } finally {
      setToggleLoading(null);
    }
  };`
);

// Update the Switch component usage
code = code.replace(
  /<label className="text-xs text-gray-500 cursor-pointer" htmlFor=\{`switch-\$\{branch\.id\}`\}>\s+\{branch\.isActive \? "Disable" : "Enable"\}\s+<\/label>\s+<Switch\s+id=\{`switch-\$\{branch\.id\}`\}\s+checked=\{branch\.isActive\}\s+onCheckedChange=\{\(\) => handleToggleStatus\(branch\.id, branch\.isActive\)\}\s+\/>/g,
  `<label className="text-xs text-gray-500" htmlFor={\`switch-\${branch.id}\`}>
                            {toggleLoading === branch.id ? "Updating..." : branch.isActive ? "Disable" : "Enable"}
                          </label>
                          <Switch
                            id={\`switch-\${branch.id}\`}
                            checked={branch.isActive}
                            disabled={toggleLoading === branch.id}
                            onCheckedChange={() => handleToggleStatus(branch.id, branch.isActive)}
                          />`
);

fs.writeFileSync(file, code);
