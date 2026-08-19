"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { Plus, Search, MapPin, MoreVertical, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function BranchesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "" });
  const [submitting, setSubmitting] = useState(false);

  const isOwner = user?.role === "OWNER";

  useEffect(() => {
    if (!user) return;
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      router.push("/");
      toast.error("Unauthorized access to Branch Management.");
      return;
    }
    fetchBranches();
  }, [user, router]);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await api.get("/branches");
      setBranches(res.data);
    } catch (error) {
      toast.error("Failed to load branches.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (!isOwner) return;
    try {
      setToggleLoading(id);
      await api.patch(`/branches/${id}`, { isActive: !currentStatus });
      toast.success(currentStatus ? "Branch deactivated." : "Branch activated.");
      setBranches((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isActive: !currentStatus } : b))
      );
    } catch (error) {
      toast.error("Failed to update branch status.");
    } finally {
      setToggleLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    if (!formData.name.trim()) return toast.error("Branch name is required.");
    
    setSubmitting(true);
    try {
      if (editingBranch) {
        // Update
        const res = await api.patch(`/branches/${editingBranch.id}`, formData);
        setBranches((prev) =>
          prev.map((b) => (b.id === res.data.id ? res.data : b))
        );
        toast.success("Branch updated fully.");
      } else {
        // Create
        const res = await api.post("/branches", formData);
        setBranches((prev) => [...prev, res.data]);
        toast.success("Branch created successfully.");
      }
      handleCloseDialog();
    } catch (error) {
      toast.error(editingBranch ? "Failed to update branch." : "Failed to create branch.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDialog = (branch?: Branch) => {
    if (!isOwner) return;
    if (branch) {
      setEditingBranch(branch);
      setFormData({ name: branch.name, address: branch.address || "" });
    } else {
      setEditingBranch(null);
      setFormData({ name: "", address: "" });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingBranch(null);
    setFormData({ name: "", address: "" });
  };

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Branch Management</h1>
            <p className="text-gray-500 mt-1">
              {isOwner
                ? "Manage bakery locations, addresses, and operational status."
                : "View operational details for your assigned branch location."}
            </p>
          </div>

          {isOwner && (
            <Button onClick={() => handleOpenDialog()} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Branch
            </Button>
          )}

          {isOwner && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingBranch ? "Edit Branch" : "Add New Branch"}</DialogTitle>
                  <DialogDescription>
                    {editingBranch
                      ? "Update the details of the existing branch location."
                      : "Create a new branch location for your bakery operations."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">
                      Branch Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="name"
                      placeholder="e.g., Downtown Bakery"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="address" className="text-sm font-medium">
                      Address
                    </label>
                    <Input
                      id="address"
                      placeholder="e.g., 123 Main St, Cityville"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Saving..." : editingBranch ? "Save Changes" : "Create Branch"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex items-center py-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search branches by name..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="border rounded-md bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                    Loading branches...
                  </TableCell>
                </TableRow>
              ) : filteredBranches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                    No branches found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredBranches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell className="text-gray-500">
                      {branch.address ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {branch.address}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">No address provided</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={branch.isActive ? "default" : "secondary"} className={branch.isActive ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200" : ""}>
                        {branch.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {new Date(branch.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {isOwner ? (
                        <div className="flex justify-end items-center gap-4">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-500" htmlFor={`switch-${branch.id}`}>
                              {toggleLoading === branch.id ? "Updating..." : branch.isActive ? "Disable" : "Enable"}
                            </label>
                            <Switch
                              id={`switch-${branch.id}`}
                              checked={branch.isActive}
                              disabled={toggleLoading === branch.id}
                              onCheckedChange={() => handleToggleStatus(branch.id, branch.isActive)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(branch)}
                            className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium">Read-Only</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
