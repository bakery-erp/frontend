"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { Search, Plus, User as UserIcon, Building2, Edit2, Eye, MoreVertical } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";

interface Branch {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  branchId: string | null;
  isActive: boolean;
  createdAt: string;
  salary: number | null;
  startDate: string | null;
  lastPaidDate: string | null;
  shift: string | null;
  filesUrl: string | null;
  branch?: {
    name: string;
  } | null;
}

const SHIFTS = ["DAY", "NIGHT"];

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, branchesRes, rolesRes] = await Promise.all([
        api.get<User[]>("/users"),
        api.get<Branch[]>("/branches"),
        api.get<string[]>("/users/roles").catch(() => ({ data: ["OWNER", "ADMIN", "BAKER", "CASHIER", "SAMBUSA_WORKER"] }))
      ]);
      setUsers(usersRes.data);
      setBranches(branchesRes.data);
      setRoles(rolesRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phone.includes(searchTerm)
  );

  const openCreate = () => {
    setEditingUser(null);
    setIsFormDialogOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setIsFormDialogOpen(true);
  };

  const openView = (u: User) => {
    setViewingUser(u);
    setIsViewDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      
      // Clean up empty strings
      if (!formData.get("salary")) formData.delete("salary");
      if (!formData.get("startDate")) formData.delete("startDate");
      if (!formData.get("lastPaidDate")) formData.delete("lastPaidDate");
      if (!formData.get("branchId")) formData.delete("branchId");
      if (!formData.get("shift")) formData.delete("shift");
      
      // On edit, if password is empty, remove it so it's not changed safely
      if (editingUser && !formData.get("password")) {
        formData.delete("password");
      }
      
      const file = formData.get("file") as File;
      if (file && file.size === 0) {
        formData.delete("file");
      }

      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("User updated successfully");
      } else {
        await api.post("/users", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("User created successfully");
      }
      
      setIsFormDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to ${editingUser ? "update" : "create"} user`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      // Direct JSON patch for simple status toggle
      await api.patch(`/users/${userId}`, { isActive: !currentStatus });
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  if (loading) return <DashboardLayout><div className="flex h-full items-center justify-center">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users & Roles</h1>
          <p className="text-zinc-500 mt-1">Manage personnel tracking, roles, and branch assignments.</p>
        </div>
        {(user?.role === "OWNER" || user?.role === "ADMIN") && (
          <Button onClick={openCreate} className="bg-black hover:bg-zinc-800 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Personnel</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900">{u.fullName}</p>
                        <p className="text-xs text-zinc-500">{u.phone}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-semibold">
                      {u.role.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.branch ? (
                      <div className="flex items-center text-zinc-600 text-sm">
                        <Building2 className="w-3 h-3 mr-1" />
                        {u.branch.name}
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-sm">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.isActive}
                      onCheckedChange={() => handleToggleStatus(u.id, u.isActive)}
                      disabled={user?.role !== "OWNER" && user?.role !== "ADMIN"}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                       <Button variant="ghost" size="sm" onClick={() => openView(u)}>
                        <Eye className="w-4 h-4 text-zinc-500" />
                      </Button>
                      {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* CREATE & EDIT DIALOG */}
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit Personnel" : "Add New Personnel"}</DialogTitle>
              <DialogDescription>
                {editingUser ? "Update the detail records for this employee." : "Create a new user entirely and assign them a default branch and role."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name *</label>
                  <Input name="fullName" defaultValue={editingUser?.fullName} placeholder="John Doe" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number *</label>
                  <Input name="phone" defaultValue={editingUser?.phone} placeholder="0911..." required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Password {editingUser && <span className="text-xs text-zinc-400 font-normal">(Leave empty to keep current)</span>} {!editingUser && "*"}
                  </label>
                  <Input name="password" type="text" placeholder={editingUser ? "********" : "Access code"} required={!editingUser} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role *</label>
                  <select
                    name="role"
                    required
                    defaultValue={editingUser?.role || ""}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Select Role</option>
                    {roles
                      .filter((r) => !(!editingUser && r === "SUPERVISOR")) // Hides supervisor on create
                      .map((r) => (
                      <option key={r} value={r}>{r.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Branch Assignment</label>
                  <select
                    name="branchId"
                    defaultValue={editingUser?.branchId || ""}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Global / Unassigned</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Shift</label>
                  <select
                    name="shift"
                    defaultValue={editingUser?.shift || ""}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">No shift</option>
                    {SHIFTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base Salary</label>
                  <Input name="salary" type="number" defaultValue={editingUser?.salary || ""} placeholder="e.g. 5000" />
                </div>
                 <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input name="startDate" type="date" defaultValue={editingUser?.startDate ? editingUser.startDate.split('T')[0] : ""} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                  <label className="text-sm font-medium">Last Paid Date</label>
                  <Input name="lastPaidDate" type="date" defaultValue={editingUser?.lastPaidDate ? editingUser.lastPaidDate.split('T')[0] : ""} />
                </div>
              </div>

              <div className="space-y-2 mt-2">
                <label className="text-sm font-medium border-b w-full block pb-2 mb-2">Documentation</label>
                {editingUser?.filesUrl && (
                  <div className="mb-2">
                    <a href={`http://localhost:3001${editingUser.filesUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs bg-blue-50 px-2 py-1 rounded">View Current Upload</a>
                  </div>
                )}
                <div className="text-xs text-zinc-500 mb-2">Upload contract, ID, or other verification files (PDF/Image)</div>
                <Input name="file" type="file" accept=".pdf,image/*" className="cursor-pointer" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-black text-white hover:bg-zinc-800">
                {isSubmitting ? "Saving..." : (editingUser ? "Save Changes" : "Create User")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW DETAILS DIALOG */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Employee Detail Card</DialogTitle>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-4 pb-4 border-b">
                <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 shrink-0">
                  <UserIcon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-zinc-900">{viewingUser.fullName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">{viewingUser.role.replace("_", " ")}</Badge>
                    <Badge className={viewingUser.isActive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                      {viewingUser.isActive ? "Active Account" : "Suspended"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-6 text-sm">
                <div>
                  <p className="text-zinc-500 font-medium mb-1">Phone Contact</p>
                  <p className="font-semibold text-zinc-900">{viewingUser.phone}</p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium mb-1">Assigned Base</p>
                  <p className="font-semibold text-zinc-900 flex items-center">
                    <Building2 className="w-3 h-3 mr-1" />
                    {viewingUser.branch?.name || "Global / Unassigned"}
                  </p>
                </div>
                
                <div>
                  <p className="text-zinc-500 font-medium mb-1">Shift</p>
                  <p className="font-semibold text-zinc-900">{viewingUser.shift || "N/A"}</p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium mb-1">Base Salary</p>
                  <p className="font-semibold text-zinc-900">{viewingUser.salary ? `${viewingUser.salary} ETB` : "N/A"}</p>
                </div>

                <div>
                  <p className="text-zinc-500 font-medium mb-1">Joined Date</p>
                  <p className="font-semibold text-zinc-900">
                    {viewingUser.startDate ? format(new Date(viewingUser.startDate), "PPP") : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium mb-1">Last Pay Date</p>
                  <p className="font-semibold text-zinc-900">
                    {viewingUser.lastPaidDate ? format(new Date(viewingUser.lastPaidDate), "PPP") : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium mb-1">Security</p>
                  <p className="font-semibold text-zinc-900 text-xs mt-0.5">Password hashed & hidden by system. Admins can rotate it in Edit menu.</p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium mb-1">Employment Document</p>
                  {viewingUser.filesUrl ? (
                    <a href={`http://localhost:3001${viewingUser.filesUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold bg-blue-50 px-2 py-0.5 rounded inline-block">
                      Open Uploaded File
                    </a>
                  ) : (
                    <span className="text-zinc-400">None attached</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
            {(user?.role === "OWNER" || user?.role === "ADMIN") && viewingUser && (
              <Button onClick={() => {
                setIsViewDialogOpen(false);
                openEdit(viewingUser);
              }} className="bg-black text-white hover:bg-zinc-800">
                <Edit2 className="w-4 h-4 mr-2" /> Edit Employee
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
