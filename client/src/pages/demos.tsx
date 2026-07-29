import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Star, Shield, HelpCircle } from "lucide-react";

export default function DemosPage() {
  const videos = [
    { title: "Getting Started with WallBuilder", duration: "3:45", category: "Basics" },
    { title: "How to Estimate Materials", duration: "5:20", category: "Tools" },
    { title: "Managing Supplier Invoices", duration: "4:15", category: "Finance" },
    { title: "Advanced Reporting Features", duration: "6:30", category: "Admin" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold font-heading">Demos & Help Center</h1>
        <p className="text-muted-foreground mt-2">
          Learn how to get the most out of the platform with our video guides.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video, index) => (
          <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="aspect-video bg-muted relative flex items-center justify-center group-hover:bg-muted/80 transition-colors">
              <PlayCircle className="w-12 h-12 text-primary opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {video.duration}
              </div>
            </div>
            <CardHeader>
              <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                {video.category}
              </div>
              <CardTitle className="text-lg leading-tight">{video.title}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-bold font-heading mb-6">Subscription Plans</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Basic</CardTitle>
              <CardDescription>For individuals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-4">Free</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2"><Star className="w-4 h-4 text-primary" /> Basic Estimator</li>
                <li className="flex gap-2"><Star className="w-4 h-4 text-primary" /> 5 Projects</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">Current Plan</Button>
            </CardFooter>
          </Card>

          <Card className="border-primary shadow-lg scale-105 relative">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
              POPULAR
            </div>
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <CardDescription>For contractors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-4">$29<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2"><Star className="w-4 h-4 text-secondary" /> Advanced Estimator</li>
                <li className="flex gap-2"><Star className="w-4 h-4 text-secondary" /> Unlimited Projects</li>
                <li className="flex gap-2"><Shield className="w-4 h-4 text-secondary" /> Priority Support</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Upgrade to Pro</Button>
            </CardFooter>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle>Enterprise</CardTitle>
              <CardDescription>For large teams</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-4">Custom</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2"><Star className="w-4 h-4 text-primary" /> Everything in Pro</li>
                <li className="flex gap-2"><Star className="w-4 h-4 text-primary" /> Dedicated Account Manager</li>
                <li className="flex gap-2"><Shield className="w-4 h-4 text-primary" /> SSO & Admin Controls</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">Contact Sales</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
