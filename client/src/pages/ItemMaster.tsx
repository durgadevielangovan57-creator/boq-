import { useData } from "@/lib/store";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, MapPin, Star } from "lucide-react";

export default function ItemMaster() {
  const [, setLocation] = useLocation();
  const { shops } = useData();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-heading text-primary">Select Supplier</h2>
          <p className="text-muted-foreground">Choose a supplier to source your materials from.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shops.map((shop) => (
            <Card 
              key={shop.id} 
              className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg"
              onClick={() => setLocation(`/item-master/${shop.id}`)}
            >
              <div className="aspect-video w-full overflow-hidden rounded-t-lg relative bg-muted">
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <Store className="h-12 w-12 text-primary/30" />
                </div>
                {shop.rating && (
                    <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded flex items-center gap-1 text-xs">
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> {shop.rating}
                    </div>
                )}
              </div>
              <CardHeader className="pb-3">
                <CardTitle className="flex justify-between items-start">
                    <span>{shop.name}</span>
                </CardTitle>
                <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {shop.location}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                    {shop.categories?.map(cat => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                            {cat}
                        </Badge>
                    ))}
                </div>
                <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
                    <Store className="mr-2 h-4 w-4" /> Visit Store
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
