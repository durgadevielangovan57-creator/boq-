import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calculator,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  Users,
  Video,
  LifeBuoy,
  Menu,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [estSearch, setEstSearch] = useState("");

  // ✅ Type-safe fallbacks (NO change to UI structure)
  const displayEmail = user?.username || "";
  const displayName =
    user?.username?.split("@")?.[0] || user?.username || "User";

  // Define navigation items based on role
  const getNavItems = () => {
    const items = [
      // Estimator - User (Client) & Admin
      {
        label: "Estimator",
        href: "/estimator",
        icon: Calculator,
        roles: ["admin", "user", "software_team"],
      },
      // Admin Dashboard shortcuts (open AdminDashboard tabs)
      {
        label: "Item Master",
        href: "/admin/dashboard?tab=materials",
        roles: ["admin", "software_team", "purchase_team"],
      },
      {
        label: "Bulk Material Upload",
        href: "/admin/bulk-material-upload",
        roles: ["admin", "software_team", "purchase_team"],
      },
      {
        label: "Categories",
        href: "/admin/dashboard?tab=categories",
        roles: ["admin", "software_team", "purchase_team"],
      },
      {
        label: "Manage Shops",
        href: "/admin/dashboard?tab=shops",
        roles: ["admin", "software_team", "supplier", "purchase_team"],
      },
      {
        label: "Approvals",
        href: "/admin/dashboard?tab=approvals",
        roles: ["admin", "software_team", "purchase_team"],
      },

      // ✅ Supplier Approvals (Admin only is better, but keeping your roles list)
      {
        label: "Supplier Approvals",
        href: "/admin/suppliers",
        roles: ["admin", "software_team", "purchase_team"],
      },

      {
        label: "Material Approvals",
        href: "/admin/dashboard?tab=material-approvals",
        roles: ["admin", "software_team", "purchase_team"],
      },
      {
        label: "Messages",
        href: "/admin/dashboard?tab=messages",
        roles: ["admin", "software_team", "purchase_team"],
      },

      // Orders/Purchases
      {
        label: "Orders",
        href: "/orders",
        icon: ShoppingCart,
        roles: ["admin", "purchase_team", "software_team"],
      },

      // Users/Clients - Admin & Software
      {
        label: "Users",
        href: "/users",
        icon: Users,
        roles: ["admin", "software_team"],
      },

      // Demo Videos - All
      {
        label: "Demos & Help",
        href: "/demos",
        icon: Video,
        roles: ["admin", "supplier", "user", "purchase_team", "software_team"],
      },

      // Support - Supplier
      {
        label: "Tech Support",
        href: "/support",
        icon: LifeBuoy,
        roles: ["supplier"],
      },

      // Settings - Admin & Software
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["admin", "software_team"],
      },
    ];

    return items.filter((item) => user?.role && item.roles.includes(user.role));
  };

  const navItems = getNavItems();

  const estimators = [
    { title: "Civil Wall", href: "/estimators/civil-wall" },
    { title: "Doors", href: "/estimators/doors" },
    { title: "Flooring", href: "/estimators/flooring" },
    { title: "Electrical", href: "/estimators/electrical" },
    { title: "Plumbing", href: "/estimators/plumbing" },
    { title: "Fire-Fighting", href: "/estimators/fire-fighting" },
    { title: "Painting", href: "/estimators/painting" },
    { title: "Blinds", href: "/estimators/blinds" },
  ];

  const filteredEstimators = useMemo(() => {
    if (!estSearch.trim()) return estimators;
    const q = estSearch.toLowerCase();
    return estimators.filter((e) => e.title.toLowerCase().includes(q));
  }, [estSearch]);

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
            WB
          </div>
          WallBuilder
        </h1>
        <p className="text-xs text-sidebar-foreground/60 mt-1 pl-1">
          {user?.role ? user.role.replace("_", " ").toUpperCase() : "GUEST"}{" "}
          PORTAL
        </p>
      </div>

      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        <div className="mb-2">
          <Input
            placeholder="Search estimators..."
            value={estSearch}
            onChange={(e) => setEstSearch(e.target.value)}
            className="w-full"
          />
          <div className="mt-2 grid gap-1">
            {filteredEstimators.slice(0, 6).map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className="text-sm px-2 py-1 rounded hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => setIsMobileOpen(false)}
              >
                {e.title}
              </Link>
            ))}
            {filteredEstimators.length === 0 && (
              <div className="text-xs text-sidebar-foreground/60">
                No estimators
              </div>
            )}
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                onClick={() => setIsMobileOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/20">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center border border-sidebar-border">
            {/* ✅ changed from user?.name to derived displayName */}
            <span className="text-sm font-bold">{displayName.charAt(0)}</span>
          </div>
          <div className="overflow-hidden">
            {/* ✅ changed from user?.name */}
            <p className="text-sm font-medium truncate">{displayName}</p>
            {/* ✅ changed from user?.email */}
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {displayEmail}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent"
          onClick={logout}
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </Button>
      </div>
    </div>
  );

  if (!user) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r border-border shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden border-b bg-background p-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 font-bold font-heading text-lg">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs">
              WB
            </div>
            WallBuilder
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
