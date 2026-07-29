import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

export default function Subscription() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      description: "For personal use",
      features: ["Access to all estimators", "Save up to 3 projects", "Basic support"],
    },
    {
      name: "Pro",
      price: "$29/mo",
      description: "For contractors & professionals",
      features: ["Unlimited projects", "Export to PDF/Excel", "Priority support", "Client management"],
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For large construction firms",
      features: ["Custom integrations", "Dedicated account manager", "White-label reports", "API access"],
    },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold font-heading">Subscription Plans</h1>
          <p className="text-muted-foreground mt-2">Choose the plan that fits your needs</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card key={plan.name} className={`flex flex-col ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-3xl font-bold mb-4">{plan.price}</div>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                  {plan.price === "Custom" ? "Contact Sales" : "Subscribe"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
