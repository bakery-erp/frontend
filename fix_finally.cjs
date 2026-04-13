const fs = require('fs');

const pathCat = '/home/nebiyu/Desktop/Growth circle/ERP/client/src/app/product-categories/page.tsx';
let catContent = fs.readFileSync(pathCat, 'utf8');

// handleCreate
catContent = catContent.replace(
  /\} catch \(e: any\) \{\s*toast\.error\(e\.response\?\.data\?\.error \|\| "Error"\);\s*console\.error\(e\);\s*\}/g,
  `} catch (e: any) {
      toast.error(e.response?.data?.error || "Error");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }`
);

fs.writeFileSync(pathCat, catContent);

const pathProd = '/home/nebiyu/Desktop/Growth circle/ERP/client/src/app/products/page.tsx';
let prodContent = fs.readFileSync(pathProd, 'utf8');

prodContent = prodContent.replace(
  /\} catch \(error: any\) \{\s*toast\.error\(error\.response\?\.data\?\.error \|\| "Error"\);\s*console\.error\(error\);\s*\}/g,
  `} catch (error: any) {
      toast.error(error.response?.data?.error || "Error");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }`
);

fs.writeFileSync(pathProd, prodContent);
console.log("Fixed!");
