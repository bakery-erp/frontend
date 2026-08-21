"use client";
import { api } from "@/lib/axios";
import { toast } from "sonner";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ConfirmModal from "@/components/ConfirmModal";

type CategoryType = "PRODUCED" | "RESELL";

interface Category {
  id: string;
  name: string;
  type: CategoryType;
  parentId: string | null;
  parent?: { id: string; name: string; type: CategoryType } | null;
  _count: { products: number; children: number };
}

export default function ProductCategoriesPage() {
  const { user } = useAuth();
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN";

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isSubcategoryOpen, setIsSubcategoryOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editParentId, setEditParentId] = useState<string>("");
  const [subParentId, setSubParentId] = useState<string>("");

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
      await api.post("/product-categories", {
        name: formData.get("name"),
        type: formData.get("type"),
        parentId: null,
      });
      toast.success("Category created");
      setIsCategoryOpen(false);
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
      await api.patch(`/product-categories/${editingCategory.id}`, {
        name: formData.get("name"),
        type: editParentId ? categories.find((category) => category.id === editParentId)?.type : formData.get("type"),
        parentId: formData.get("parentId") || null,
      });
      toast.success("Category updated");
      setEditingCategory(null);
      setEditParentId("");
      fetchCategories();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      await api.delete(`/product-categories/${categoryToDelete.id}`);
      toast.success("Category deleted");
      fetchCategories();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error");
      console.error(e);
    } finally {
      setCategoryToDelete(null);
    }
  };

  const rootCategories = categories.filter((category) => category.parentId === null);
  const subcategories = categories.filter((category) => category.parentId !== null);
  const parentOptions = categories;
  const editSelectedParent = categories.find((category) => category.id === editParentId) || null;
  const subParent = categories.find((category) => category.id === subParentId) || null;

  const visibleCategories = categories;

  const getCategoryNameById = (id: string | null) => {
    if (!id) return null;
    return categories.find((category) => category.id === id)?.name ?? null;
  };

  const getChildCount = (id: string) => categories.filter((category) => category.parentId === id).length;

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Product Categories</h1>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsSubcategoryOpen(true)}>Add Subcategory</Button>
            <Button onClick={() => setIsCategoryOpen(true)}>Add Category</Button>
          </div>
        )}
      </div>

      {canManage && (
        <Dialog open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
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
      )}

      {canManage && (
        <Dialog open={isSubcategoryOpen} onOpenChange={setIsSubcategoryOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Subcategory</DialogTitle></DialogHeader>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setIsSubmitting(true);
                const formData = new FormData(event.currentTarget);
                try {
                  await api.post("/product-categories", {
                    name: formData.get("name"),
                    type: subParent?.type,
                    parentId: formData.get("parentId"),
                  });
                  toast.success("Subcategory created");
                  setIsSubcategoryOpen(false);
                  setSubParentId("");
                  fetchCategories();
                } catch (e: any) {
                  toast.error(e.response?.data?.error || "Error");
                  console.error(e);
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              <div className="space-y-4 mb-4">
                <div>
                  <label className="text-sm font-medium">Subcategory Name</label>
                  <Input name="name" required placeholder="e.g. Brown Bread" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Parent Category</label>
                  <select
                    name="parentId"
                    required
                    value={subParentId}
                    onChange={(event) => setSubParentId(event.target.value)}
                    className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm"
                  >
                    <option value="">Select a parent category</option>
                    {rootCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category.type})
                      </option>
                    ))}
                  </select>
                  {rootCategories.length === 0 && (
                    <p className="mt-2 text-xs text-zinc-500">Create a top-level category first, then add subcategories under it.</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <Input value={subParent?.type || ""} readOnly placeholder="Select a parent category first" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting || !subParent}>{isSubmitting ? "Creating..." : "Create Subcategory"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category Name</TableHead>
              <TableHead>Parent Category</TableHead>
              <TableHead>Hierarchy Level</TableHead>
              <TableHead>Product Type</TableHead>
              <TableHead className="text-center">Products Count</TableHead>
              <TableHead className="text-center">Subcategories</TableHead>
              <TableHead className="text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361]">Loading categories...</TableCell></TableRow>
            ) : visibleCategories.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361]">No product categories found.</TableCell></TableRow>
            ) : visibleCategories.map(cat => (
              <TableRow key={cat.id}>
                <TableCell className="font-bold text-[#2C1B10]">
                  <span className={cat.parentId ? "pl-5 border-l-2 border-[#E87A18]/40 inline-block" : ""}>{cat.name}</span>
                </TableCell>
                <TableCell className="text-xs font-semibold text-[#8C7361]">
                  {getCategoryNameById(cat.parentId) || cat.parent?.name || "—"}
                </TableCell>
                <TableCell>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cat.parentId ? 'bg-zinc-100 text-zinc-700 border border-zinc-200' : 'bg-amber-100 text-amber-900 border border-amber-200'}`}>
                    {cat.parentId ? '↳ Subcategory' : '📁 Root Category'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cat.type === 'PRODUCED' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-purple-100 text-purple-800 border border-purple-200'}`}>
                    {cat.type}
                  </span>
                </TableCell>
                <TableCell className="text-center font-bold text-[#2C1B10]">{cat._count?.products || 0}</TableCell>
                <TableCell className="text-center font-bold text-[#8C7361]">{getChildCount(cat.id)}</TableCell>
                <TableCell className="text-right pr-6 space-x-1">
                  {canManage && <Button variant="ghost" size="sm" className="font-bold text-xs text-[#4A2E1B] hover:text-[#E87A18] hover:bg-[#FAF6F0]" onClick={() => setEditingCategory(cat)}>Edit</Button>}
                  {canManage && <Button variant="ghost" size="sm" className="font-bold text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => setCategoryToDelete(cat)}>Delete</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#EDE4D5] bg-[#FAF6F0] flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider">Subcategories Overview</h2>
          <span className="text-xs font-bold text-[#8C7361] bg-white px-2.5 py-1 rounded-full border border-[#EDE4D5]">{subcategories.length} total</span>
        </div>
        {subcategories.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#8C7361] font-medium">No subcategories found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subcategory Name</TableHead>
                <TableHead>Parent Category</TableHead>
                <TableHead className="text-center">Assigned Products</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subcategories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-bold text-[#2C1B10] pl-6">↳ {cat.name}</TableCell>
                  <TableCell className="text-xs font-semibold text-[#8C7361]">{getCategoryNameById(cat.parentId) || cat.parent?.name || "—"}</TableCell>
                  <TableCell className="text-center font-bold text-[#2C1B10]">{cat._count?.products || 0}</TableCell>
                  <TableCell className="text-right pr-6 space-x-1">
                    {canManage && <Button variant="ghost" size="sm" className="font-bold text-xs text-[#4A2E1B] hover:text-[#E87A18] hover:bg-[#FAF6F0]" onClick={() => setEditingCategory(cat)}>Edit</Button>}
                    {canManage && <Button variant="ghost" size="sm" className="font-bold text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => setCategoryToDelete(cat)}>Delete</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {canManage && (
        <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
            {editingCategory && (
              <form onSubmit={handleEdit} key={editingCategory.id}>
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="text-sm font-medium">Category Name</label>
                    <Input name="name" required defaultValue={editingCategory.name} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Type</label>
                    <select
                      name="type"
                      required
                      value={editSelectedParent?.type || editingCategory.type}
                      disabled={!!editSelectedParent}
                      onChange={() => undefined}
                      className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm disabled:opacity-70"
                    >
                      <option value="PRODUCED">PRODUCED</option>
                      <option value="RESELL">RESELL</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Parent Category</label>
                    <select
                      name="parentId"
                      value={editParentId || editingCategory.parentId || ""}
                      onChange={(event) => setEditParentId(event.target.value)}
                      className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm"
                    >
                      <option value="">Top-level category</option>
                      {parentOptions
                        .filter((category) => category.id !== editingCategory.id)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name} ({category.type})
                          </option>
                        ))}
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
      )}

      {/* Delete Category Confirmation Modal */}
      <ConfirmModal
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={confirmDeleteCategory}
        title="Delete Product Category"
        description={`Are you sure you want to delete '${categoryToDelete?.name}'? This action cannot be undone.`}
        confirmText="Delete Category"
        variant="danger"
      />
    </DashboardLayout>
  );
}
