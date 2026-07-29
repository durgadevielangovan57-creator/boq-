import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, FileText } from "lucide-react";

export default function ClientTenders() {
  return (
    <Layout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Client Portal</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Welcome to your Secure Tender Dashboard</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Tenders</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Pending your review</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>My Tenders</CardTitle>
            <CardDescription>View tenders assigned to your organization for technical or commercial evaluation.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium">No Tenders Assigned</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                You currently do not have any tenders assigned to you for evaluation. You will receive an email notification when one is assigned.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
