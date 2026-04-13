"use client";
import { api } from "@/lib/axios";
import { toast } from "sonner";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

interface ProductCategory {
  id: string;
  name: string;
  type: "PRODUCED" | "RESELL";
}

interface Product {
  id: string;
  name: string;
  flavor?: string;
  unitType: "PIECE" | "KG" | "LITER";
  basePrice: number;
  buyPrice?: number;
  isActive: boolean;
  categoryId: string;
  category?: ProductCategory;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resProd, resCat] = await Promise.all([
        api.get("/products"),
        api.get("/product-categories")
      ]);
      setProducts(resProd.data);
      setCategories(resCat.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, isEdit: boolean) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      categoryId: formData.get("categoryId"),
      name: formData.get("name"),
      flavor: formData.get("flavor") || undefined,
      unitType: formData.get("unitType"),
      basePrice: Number(formData.get("basePrice")),
      buyPrice: formData.get("buyPrice") ? Number(formData.get("buyPrice")) : undefined,
      isActive: formData.get("isActive") === "true"
    };

    const url = isEdit && editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = isEdit && editingProduct
        ? await api.patch(`/products/${editingProduct.id}`, data)
        : await api.post("/products", data);
      
      toast.success(isEdit ? "Product updated" : "Product created");
      setIsAddOpen(false);
      setEditingProduct(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button onClick={() => setIsAddOpen(true)}>Add Product</Button>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Sell Price</TableHead>
              <TableHead>Cost Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-zinc-400">Loading products...</TableCell></TableRow>
            ) : products.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-zinc-400">No products found. Create a category first.</TableCell></TableRow>
            ) : products.map(prod => (
              <TableRow key={prod.id}>
                <TableCell className="font-medium">
                  {prod.name} {prod.flavor && <span className="text-xs text-zinc-500 ml-1">({prod.flavor})</span>}
                </TableCell>
                <TableCell>{prod.category?.name || "Unknown"}</TableCell>
                <TableCell>{prod.category?.type || "N/A"}</TableCell>
                <TableCell>{prod.unitType}</TableCell>
                <TableCell>{Number(prod.basePrice).toFixed(2)} ETB</TableCell>
                <TableCell>{prod.buyPrice != null ? `${Number(prod.buyPrice).toFixed(2)} ETB` : "-"}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${prod.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {prod.isActive ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setEditingProduct(prod)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dialogs wrapper */}
      {(isAddOpen || editingProduct) && (
        <Dialog open={true} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingProduct(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => handleSubmit(e, !!editingProduct)}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1 block">Name</label>
                  <Input name="name" required defaultValue={editingProduct?.name || ""} placeholder="e.g. White Bread" />
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <select name="categoryId" required defaultValue={editingProduct?.categoryId || ""} className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                    <option value="" disabled>Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium mb-1 block">Unit</label>
                  <select name="unitType" required defaultValue={editingProduct?.unitType || "PIECE"} className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                    <option value="PIECE">Piece</option>
                    <option value="KG">Kg</option>
                    <option value="LITER">Liter</option>
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium mb-1 block">Selling Price (ETB)</label>
                  <Input name="basePrice" type="number" step="0.01" required defaultValue={editingProduct?.basePrice ?? ""} />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium mb-1 block">Cost/Buy Price (ETB) - Optional</label>
                  <Input name="buyPrice" type="number" step="0.01" defaultValue={editingProduct?.buyPrice ?? ""} />
                </div>
                
                {editingProduct && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">Status</label>
                    <select name="isActive" required defaultValue={editingProduct.isActive ? "true" : "false"} className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsAddOpen(false); setEditingProduct(null); }}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? (editingProduct ? "Saving..." : "Creating...") : (editingProduct ? "Save Changes" : "Create Product")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

    </DashboardLayout>
  );
}
