import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Hammer } from "lucide-react";

export default function PlaceholderPage() {
  const [location] = useLocation();
  const pageName = location.split("/")[1].charAt(0).toUpperCase() + location.split("/")[1].slice(1);

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 text-center animate-in fade-in zoom-in duration-500">
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
        <Hammer className="w-10 h-10 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-heading">{pageName} Page</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          This feature is currently under development. Check back soon for updates!
        </p>
      </div>
      <Card className="w-full max-w-md mt-8">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Dev Note</CardTitle>
        </CardHeader>
        <CardContent className="text-sm font-mono bg-muted/30 p-4 rounded-md mx-6 mb-6">
          Page Route: {location}<br/>
          Status: Placeholder<br/>
          Component: PlaceholderPage.tsx
        </CardContent>
      </Card>
    </div>
  );
}
