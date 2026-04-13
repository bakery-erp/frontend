"use client";
import { api } from "@/lib/axios";
import { toast } from "sonner";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

type CategoryType = "PRODUCED" | "RESELL";

interface Category {
  id: string;
  name: string;
  type: CategoryType;
  _count: { products: number };
}

export default function ProductCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get("/product-categories");
      setCategories(res.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await api.post("/product-categories", {
          name: formData.get("name"),
          type: formData.get("type"),
        });
        toast.success("Category created");
        setIsAddOpen(false);
        fetchCategories();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCategory) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await api.patch(`/product-categories/${editingCategory.id}`, {
          name: formData.get("name"),
          type: formData.get("type"),
        });
        toast.success("Category updated");
        setEditingCategory(null);
        fetchCategories();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Product Categories</h1>
        <Button onClick={() => setIsAddOpen(true)}>Add Category</Button>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Add New Category</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="text-sm font-medium">Category Name</label>
                  <Input name="name" required placeholder="e.g. Bread" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <select name="type" required className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                    <option value="PRODUCED">PRODUCED</option>
                    <option value="RESELL">RESELL</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      <div className="bg-white border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Products</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-zinc-400">Loading categories...</TableCell></TableRow>
            ) : categories.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-zinc-400">No product categories found</TableCell></TableRow>
            ) : categories.map(cat => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${cat.type === 'PRODUCED' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                    {cat.type}
                  </span>
                </TableCell>
                <TableCell>{cat._count?.products || 0}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setEditingCategory(cat)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          {editingCategory && (
            <form onSubmit={handleEdit}>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="text-sm font-medium">Category Name</label>
                  <Input name="name" required defaultValue={editingCategory.name} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <select name="type" required defaultValue={editingCategory.type} className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                    <option value="PRODUCED">PRODUCED</option>
                    <option value="RESELL">RESELL</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
