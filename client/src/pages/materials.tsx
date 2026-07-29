import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Upload, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

// Form Schema
const materialFormSchema = z.object({
  itemName: z.string().min(2, { message: "Name is required" }),
  sku: z.string().min(2, { message: "SKU is required" }),
  rate: z.coerce.number().min(0),
  brand: z.string().min(1, { message: "Brand is required" }),
  model: z.string().optional(),
  unit: z.string().min(1, { message: "Unit is required" }),
  category: z.string().min(1, { message: "Category is required" }),
  subCategory: z.string().optional(),
  supplier: z.string().min(1, { message: "Supplier is required" }),
  shop: z.string().optional(),
  technicalSpec: z.string().optional(),
  dimensions: z.string().optional(),
  finishType: z.string().optional(),
  metalType: z.string().optional(),
});

export default function MaterialsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [generatedItemCode, setGeneratedItemCode] = useState("");
  
  // Only allow purchase team, admin, software team
  const canEdit = ["purchase_team", "admin", "software_team"].includes(user?.role || "");

  const form = useForm<z.infer<typeof materialFormSchema>>({
    resolver: zodResolver(materialFormSchema),
    defaultValues: {
      itemName: "",
      sku: "",
      rate: 0,
      brand: "",
      model: "",
      unit: "",
      category: "",
      subCategory: "",
      supplier: "",
      shop: "",
      technicalSpec: "",
      dimensions: "",
      finishType: "",
      metalType: "",
    },
  });

    const itemName = form.watch("itemName");
  
  // Auto-generate Item Code based on name
  useEffect(() => {
    if (itemName && itemName.length > 2) {
      const code = itemName.substring(0, 3).toUpperCase() + "-" + Math.floor(Math.random() * 10000);
      setGeneratedItemCode(code);
    } else {
      setGeneratedItemCode("");
    }
  }, [itemName]);

  function onSubmit(values: z.infer<typeof materialFormSchema>) {
    // Check for "irrelevant" material (Mock logic as requested)
    const irrelevantKeywords = ["toy", "game", "food", "candy"];
    const isIrrelevant = irrelevantKeywords.some(keyword => 
      values.itemName.toLowerCase().includes(keyword)
    );

    if (isIrrelevant) {
      toast({
        variant: "destructive",
        title: "Security Alert Triggered",
        description: "Irrelevant material detected. Admin and Software team have been notified.",
      });
      return;
    }

    toast({
      title: "Item Added Successfully",
      description: `${values.itemName} has been added to inventory with code ${generatedItemCode}.`,
    });
    
    // Reset form
    form.reset();
  }

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <h2 className="text-2xl font-bold text-muted-foreground">Access Restricted</h2>
        <p className="mt-2 text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-heading">Item Management</h1>
          <p className="text-muted-foreground">View and manage inventory items.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Right Column: Image & Helper */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Image</CardTitle>
              <CardDescription>Upload a clear image of the product.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center p-10 text-center hover:bg-muted/50 transition-colors cursor-pointer group">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Click to upload image</p>
                <p className="text-xs text-muted-foreground mt-1">SVG, PNG, JPG or GIF (max. 800x400px)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20">
            <CardHeader>
              <CardTitle className="text-blue-800 dark:text-blue-100 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Image Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-700 dark:text-blue-200">
              <ul className="list-disc pl-4 space-y-1">
                <li>Use white background</li>
                <li>Ensure good lighting</li>
                <li>Show product from multiple angles if possible</li>
                <li>Do not include watermarks</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
