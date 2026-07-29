import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Calculator, Download, Share2 } from "lucide-react";

export default function EstimatorPage() {
  const [wallArea, setWallArea] = useState(100);
  const [brickPrice, setBrickPrice] = useState(12);
  const [cementPrice, setCementPrice] = useState(450);

  // Simple calculation logic
  const bricksNeeded = Math.ceil(wallArea * 8.5); // Approx bricks per sq ft
  const cementBagsNeeded = Math.ceil(wallArea / 50); // Approx
  const sandTonsNeeded = Math.ceil(wallArea / 200);

  const totalCost = (bricksNeeded * brickPrice) + (cementBagsNeeded * cementPrice) + (sandTonsNeeded * 2500);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center md:text-left">
        <h1 className="text-3xl font-bold font-heading">Construction Estimator</h1>
        <p className="text-muted-foreground mt-2">
          Calculate material requirements and approximate costs for your wall construction.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader>
            <CardTitle>Input Parameters</CardTitle>
            <CardDescription>Adjust the values to match your project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-base">Wall Area (Sq. Ft)</Label>
                <span className="text-xl font-bold text-primary">{wallArea} <span className="text-sm font-normal text-muted-foreground">sq.ft</span></span>
              </div>
              <Slider 
                value={[wallArea]} 
                onValueChange={(v) => setWallArea(v[0])} 
                max={5000} 
                step={10} 
                className="py-4"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Brick Rate (₹/pc)</Label>
                <Input 
                  type="number" 
                  value={brickPrice} 
                  onChange={(e) => setBrickPrice(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cement Rate (₹/bag)</Label>
                <Input 
                  type="number" 
                  value={cementPrice} 
                  onChange={(e) => setCementPrice(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <Label className="mb-2 block">Wall Type</Label>
              <Tabs defaultValue="4inch" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="4inch">4" Single Brick</TabsTrigger>
                  <TabsTrigger value="9inch">9" Double Brick</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white shadow-xl border-none relative overflow-hidden">
          {/* Decorative background */}
          <div className="absolute top-0 right-0 p-32 bg-primary/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-secondary" />
              Estimation Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 relative z-10">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-slate-300">Bricks Required</span>
                <span className="font-mono font-bold text-xl">{bricksNeeded.toLocaleString()} <span className="text-xs text-slate-400">pcs</span></span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-slate-300">Cement Bags</span>
                <span className="font-mono font-bold text-xl">{cementBagsNeeded} <span className="text-xs text-slate-400">bags</span></span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-slate-300">Sand</span>
                <span className="font-mono font-bold text-xl">{sandTonsNeeded} <span className="text-xs text-slate-400">tons</span></span>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 mt-6">
              <p className="text-sm text-slate-400 mb-1">Estimated Total Cost</p>
              <div className="text-4xl font-bold text-secondary font-heading">
                ₹ {totalCost.toLocaleString()}
              </div>
            </div>
          </CardContent>
          <CardFooter className="gap-2 relative z-10">
            <Button variant="secondary" className="w-full text-slate-900 font-bold hover:bg-secondary/90">
              <Share2 className="w-4 h-4 mr-2" /> Save Quote
            </Button>
            <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 hover:text-white">
              <Download className="w-4 h-4 mr-2" /> PDF
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
