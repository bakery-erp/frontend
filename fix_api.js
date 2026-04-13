const fs = require('fs');

function fixFiles() {
  const catPath = 'src/app/product-categories/page.tsx';
  let catContent = fs.readFileSync(catPath, 'utf8');
  catContent = catContent.replace('"use client";', '"use client";\nimport { api } from "@/lib/axios";\nimport { toast } from "sonner";');
  
  catContent = catContent.replace(/const res = await fetch\("\/api\/productCategories"[\s\S]*?\);\s*if \(res\.ok\) setCategories\(await res\.json\(\)\);/g, 
    'const res = await api.get("/productCategories");\n      setCategories(res.data);');
    
  catContent = catContent.replace(/const res = await fetch\("\/api\/productCategories"[\s\S]*?\}\);\s*if \(res\.ok\) \{\s*setIsAddOpen\(false\);\s*fetchCategories\(\);\s*\} else \{\s*alert\(await res\.text\(\)\);\s*\}/g,
    `const res = await api.post("/productCategories", {
          name: formData.get("name"),
          type: formData.get("type"),
        });
        toast.success("Category created");
        setIsAddOpen(false);
        fetchCategories();`);

  catContent = catContent.replace(/const res = await fetch\(`\/api\/productCategories\/\$\{editingCategory\.id\}`[\s\S]*?\}\);\s*if \(res\.ok\) \{\s*setEditingCategory\(null\);\s*fetchCategories\(\);\s*\} else \{\s*alert\(await res\.text\(\)\);\s*\}/g,
    `const res = await api.patch(\`/productCategories/\${editingCategory.id}\`, {
          name: formData.get("name"),
          type: formData.get("type"),
        });
        toast.success("Category updated");
        setEditingCategory(null);
        fetchCategories();`);

  catContent = catContent.replace(/catch \(e\) {/g, 'catch (e: any) {\n      toast.error(e.response?.data?.error || "Error");');
  fs.writeFileSync(catPath, catContent);
  
  const prodPath = 'src/app/products/page.tsx';
  let prodContent = fs.readFileSync(prodPath, 'utf8');
  prodContent = prodContent.replace('"use client";', '"use client";\nimport { api } from "@/lib/axios";\nimport { toast } from "sonner";');
  
  prodContent = prodContent.replace(/const \[resProd, resCat\] = await Promise\.all\(\[\s*fetch\("\/api\/products"[\s\S]*?\),\s*fetch\("\/api\/productCategories"[\s\S]*?\)\s*\]\);\s*if \(resProd\.ok\) setProducts\(await resProd\.json\(\)\);\s*if \(resCat\.ok\) setCategories\(await resCat\.json\(\)\);/g,
    `const [resProd, resCat] = await Promise.all([
        api.get("/products"),
        api.get("/productCategories")
      ]);
      setProducts(resProd.data);
      setCategories(resCat.data);`);
      
  prodContent = prodContent.replace(/const res = await fetch\(url, \{\s*method,\s*headers: [\s\S]*?body: JSON\.stringify\(data\)\s*\}\);\s*if \(res\.ok\) \{\s*setIsAddOpen\(false\);\s*setEditingProduct\(null\);\s*fetchData\(\);\s*\} else \{\s*alert\(await res\.text\(\)\);\s*\}/g,
    `const res = isEdit && editingProduct
        ? await api.patch(\`/products/\${editingProduct.id}\`, data)
        : await api.post("/products", data);
      
      toast.success(isEdit ? "Product updated" : "Product created");
      setIsAddOpen(false);
      setEditingProduct(null);
      fetchData();`);
      
  prodContent = prodContent.replace(/catch \(e\) {/g, 'catch (e: any) {\n      toast.error(e.response?.data?.error || "Error");');
  prodContent = prodContent.replace(/catch \(error\) {/g, 'catch (error: any) {\n      toast.error(error.response?.data?.error || "Error");');
  fs.writeFileSync(prodPath, prodContent);
}

fixFiles();
console.log("Fixed files");
