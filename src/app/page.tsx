'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Store, Users, Activity, LayoutDashboard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Dashboard() {
  return (
    <DashboardLayout>
       <h1 className="text-3xl font-bold tracking-tight mb-2">Overview</h1>
       <p className="text-zinc-500 mb-8">Welcome back. Here is what's happening at your branches today.</p>
       
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
              <Store className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-zinc-500">+1 from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
              <Users className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-zinc-500">Active across all branches</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
              <Activity className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">ETB 45,230</div>
              <p className="text-xs text-zinc-500">+12.5% from yesterday</p>
            </CardContent>
          </Card>
       </div>

       <Card className="min-h-[400px] border-dashed bg-zinc-50/50 flex flex-col items-center justify-center shadow-none">
          <LayoutDashboard className="w-10 h-10 text-zinc-300 mb-4" />
          <CardTitle className="text-zinc-600">Analytics Space</CardTitle>
          <CardDescription className="max-w-xs text-center mt-2">
            Advanced charts, sales tables, and metrics will appear down here in your brand new Next.js structure.
          </CardDescription>
       </Card>
    </DashboardLayout>
  );
}
