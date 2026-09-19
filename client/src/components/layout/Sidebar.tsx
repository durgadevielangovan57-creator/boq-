import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  BrickWall,
  DoorOpen,
  Cloud,
  Layers,
  PaintBucket,
  Blinds,
  Zap,
  Droplets,
  Hammer,
  ShieldAlert,
  Menu,
  Moon,
  Sun,
  LogOut,
  Settings,
  Package,
  MessageSquare,
  CheckCircle2,
  ShoppingCart,
  AlertCircle,
  Users,
  Tags,
  FolderKanban,
  Truck,
  FileText,
  ClipboardCheck,
  BookOpen,
  ShieldCheck,
  Eye,
  EyeOff,
  RotateCcw,
  Edit3,
  Archive,
  Trash2,
  ChevronRight,
  ChevronLeft,
  PlusCircle,
  FileStack,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/lib/store";
import apiFetch from "@/lib/api";

type SubcategoryItem = {
  id: string;
  name: string;
  href: string | null;
  icon: string;
  category: string;
};

const iconMap: Record<string, any> = {
  BrickWall: BrickWall,
  DoorOpen: DoorOpen,
  Cloud: Cloud,
  Layers: Layers,
  PaintBucket: PaintBucket,
  Blinds: Blinds,
  Zap: Zap,
  Droplets: Droplets,
  Hammer: Hammer,
  ShieldAlert: ShieldAlert,
};

const estimatorItems = [
  { icon: BrickWall, label: "Civil ", href: "/estimators/civil-wall" },
  { icon: DoorOpen, label: "Doors", href: "/estimators/doors" },
  { icon: Cloud, label: "False Ceiling", href: "/estimators/false-ceiling" },
  { icon: Layers, label: "Flooring", href: "/estimators/flooring" },
  { icon: PaintBucket, label: "Painting", href: "/estimators/painting" },
  { icon: Blinds, label: "Blinds", href: "/estimators/blinds" },
  { icon: Zap, label: "Electrical", href: "/estimators/electrical" },
  { icon: Droplets, label: "Plumbing", href: "/estimators/plumbing" },
  //{ icon: Hammer, label: "MS Work", href: "/estimators/ms-work" },
  //{ icon: Hammer, label: "SS Work", href: "/estimators/ss-work" },
  //{ icon: ShieldAlert, label: "Fire-Fighting", href: "/estimators/fire-fighting" },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem('sidebar-theme') === 'dark';
    }
    return false;
  });

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (typeof window !== "undefined") {
      localStorage.setItem('sidebar-theme', next ? 'dark' : 'light');
    }
  };

  const theme = {
    bg: isDark ? '#2563EB' : '#F9FAFB',
    border: isDark ? '#1D4ED8' : '#E5E7EB',
    headerText: isDark ? '#FFFFFF' : '#374151',
    headerHoverBg: isDark ? '#1D4ED8' : '#F3F4F6',
    headerActiveBg: isDark ? '#1E40AF' : '#F5F3FF',
    subItemText: isDark ? '#BFDBFE' : '#4A5568',
    subItemHoverBg: isDark ? '#1D4ED8' : '#F3F4F6',
    subItemActiveBg: isDark ? '#FFFFFF' : '#EDE9FE',
    subItemActiveText: isDark ? '#2563EB' : '#6366f1',
    iconDefault: isDark ? '#93C5FD' : '#9CA3AF',
    iconActive: isDark ? '#FFFFFF' : '#6366f1',
    labelText: isDark ? '#93C5FD' : '#9CA3AF',
    userBg: isDark ? '#1D4ED8' : '#F9FAFB',
    userName: isDark ? '#FFFFFF' : '#111827',
    userEmail: isDark ? '#BFDBFE' : '#6B7280',
    logoBuild: isDark ? '#FFFFFF' : '#111827',
    logoEstimate: isDark ? '#BFDBFE' : '#6366f1',
  };

  const [settingsHover, setSettingsHover] = useState(false);
  const [collapseHover, setCollapseHover] = useState(false);
  const [themeHover, setThemeHover] = useState(false);
  const [logoutHover, setLogoutHover] = useState(false);

  const [location, setLocation] = useLocation();
  const [estSearch, setEstSearch] = useState("");
  const [subcategories, setSubcategories] = useState<SubcategoryItem[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(true);
  const { user, logout, supportMessages, materialApprovalRequests } = useData();
  const [alertsCount, setAlertsCount] = useState(0);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar_collapsed") === "true";
    }
    return false;
  });

  const [openSection, setOpenSection] = useState<string | null>(null);

  const getSectionForRoute = (loc: string): string | null => {
    const query = typeof window !== 'undefined' ? window.location.search : '';
    const pathWithSearch = loc + query;
    if (pathWithSearch.includes('tab=materials') || pathWithSearch.includes('tab=create-product') || pathWithSearch.includes('tab=shops')) return 'creations';
    if (pathWithSearch.includes('tab=approvals') || pathWithSearch.includes('tab=material-approvals')) return 'approvals';
    if (pathWithSearch.includes('tab=messages')) return 'communication';

    if (loc.includes('/dashboard') || loc.includes('/project-dashboard') ||
      loc.includes('/admin/spy') || loc.includes('/admin/access-control'))
      return 'overview';
    if (loc.includes('create-item') || loc.includes('create-product') ||
      loc.includes('create-project') || loc.includes('vendor-categories'))
      return 'creations';
    if (loc.includes('manage-product') || loc.includes('manage-materials') ||
      loc.includes('manage-shops') || loc.includes('manage-categories') ||
      loc.includes('bulk-material-upload'))
      return 'management';
    if (loc.includes('create-bom') || loc.includes('generate-po') ||
      loc.includes('finalize-bom') || loc.includes('sketch-plans'))
      return 'boq';
    if (loc.includes('site-reports'))
      return 'site';
    if (loc.includes('purchase-orders') || loc.includes('delivery-tracker') ||
      loc.includes('form-builder') || loc.includes('tenders') ||
      loc.includes('po-approvals'))
      return 'procurement';
    if (loc.includes('raise-po-request') || loc.includes('my-po-requests'))
      return 'porequests';
    if (loc.includes('approvals') || loc.includes('suppliers') ||
      loc.includes('proposal-approvals') || loc.includes('purchase-team-bom'))
      return 'approvals';
    if (loc.includes('archive') || loc.includes('trash'))
      return 'storage';
    if (loc.includes('tab=messages') || loc.includes('support'))
      return 'communication';
    if (loc.includes('subscription') || loc.includes('user-manual'))
      return 'resources';
    return null;
  };

  useEffect(() => {
    const section = getSectionForRoute(location);
    if (section) setOpenSection(section);
  }, [location]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const mainEl = document.querySelector("main");
      if (mainEl) {
        if (isOpen && isCollapsed) {
          mainEl.classList.remove("md:pl-64");
          mainEl.classList.add("md:pl-16");
        } else if (isOpen) {
          mainEl.classList.remove("md:pl-16");
          mainEl.classList.add("md:pl-64");
        } else {
          mainEl.classList.remove("md:pl-16", "md:pl-64");
        }
      }
    }
  }, [isOpen, isCollapsed]);

  const toggleSection = (key: string) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      localStorage.setItem("sidebar_collapsed", "false");
      setOpenSection(key);
    } else {
      setOpenSection(prev => prev === key ? null : key);
    }
  };

  const toggleEditMode = () => {
    setIsEditMode(prev => {
      const next = !prev;
      if (next && isCollapsed) {
        setIsCollapsed(false);
        localStorage.setItem("sidebar_collapsed", "false");
      }
      return next;
    });
  };

  // --- Sidebar Hiding Logic ---
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_hidden_items");
    if (saved) {
      try {
        setHiddenItems(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error("Failed to parse hidden items", e);
      }
    }
  }, []);

  const toggleHideItem = (e: React.MouseEvent, itemKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setHiddenItems(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      localStorage.setItem("sidebar_hidden_items", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const resetHiddenItems = () => {
    if (confirm("Show all hidden sidebar items?")) {
      setHiddenItems(new Set());
      localStorage.removeItem("sidebar_hidden_items");
    }
  };

  const SidebarNavItem = ({ href, icon: Icon, label, badge, count, adminTab, activePaths, id, condition = true, isSubItem = true, visible }: {
    href: string | null;
    icon: any;
    label: string;
    badge?: React.ReactNode;
    count?: number;
    adminTab?: string | string[];
    // Extra pathnames (matched by prefix) that should also count as "active"
    // for this item — for items like "Create" that fan out to a page which
    // isn't a ?tab= of /admin/dashboard (e.g. /admin/vendor-categories).
    activePaths?: string[];
    id: string;
    condition?: boolean;
    isSubItem?: boolean;
    // When provided, overrides the normal isVisible(id, condition) check.
    // Used for merged items (like "Create") that stand in for more than one
    // custom-permission module key, so admin-managed per-user permissions
    // still work correctly for each of the underlying modules.
    visible?: boolean;
  }) => {
    if (!(visible !== undefined ? visible : isVisible(id, condition))) return null;
    if (!href) return null;
    const isHidden = hiddenItems.has(id);
    if (isHidden && !isEditMode) return null;

    const currentTab = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("tab");
    const matchesAdminTab = adminTab
      ? (Array.isArray(adminTab) ? adminTab.includes(currentTab || "") : currentTab === adminTab)
      : false;
    const matchesActivePath = activePaths ? activePaths.some((p) => location.startsWith(p)) : false;
    const isActive = adminTab || activePaths ? (matchesAdminTab || matchesActivePath) : location === href;
    const [isHovered, setIsHovered] = useState(false);

    if (isSubItem) {
      return (
        <Link href={href} onClick={(e) => {
          if ((window as any).isSketchPlanDirty) {
            if (!window.confirm("⚠️ WARNING: You have UNSAVED changes! ⚠️\n\nClick 'Cancel' to STAY on this page so you can save your work.\nClick 'OK' to DISCARD your changes and exit.")) {
              e.preventDefault();
              return;
            }
          }
        }}>
          <span
            className={cn(
              isCollapsed
                ? "w-8 h-8 flex items-center justify-center mx-auto rounded-lg transition-all mb-1 cursor-pointer group relative text-left text-[12px]"
                : "flex items-center gap-2 rounded-md px-2.5 transition-all mb-1 cursor-pointer group relative text-left h-9 text-[12px]",
              isActive ? "font-medium" : "font-normal",
              isHidden && "opacity-40 grayscale-[0.5]"
            )}
            style={{
              backgroundColor: isActive
                ? theme.subItemActiveBg
                : (isHovered ? theme.subItemHoverBg : 'transparent'),
              color: isActive ? theme.subItemActiveText : theme.subItemText,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={closeSidebarOnMobile}
            title={isCollapsed ? label : undefined}
          >
            <Icon
              className="h-3.5 w-3.5 flex-shrink-0 transition-colors"
              style={{
                color: isActive ? theme.iconActive : theme.iconDefault
              }}
            />
            {!isCollapsed && <span className="truncate flex-1">{label}</span>}
            {!isCollapsed && count !== undefined && count > 0 && (
              <Badge variant="destructive" className="ml-auto pointer-events-none text-[9px] px-1 py-0 h-4 min-w-[16px] flex items-center justify-center">
                {count}
              </Badge>
            )}
            {!isCollapsed && badge && !count && <span className="ml-auto">{badge}</span>}

            {!isCollapsed && (
              <button
                onClick={(e) => toggleHideItem(e, id)}
                className={cn(
                  "p-0.5 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-all ml-1",
                  isEditMode ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
                )}
                title={isHidden ? "Unhide" : "Hide"}
              >
                {isHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
            )}
          </span>
        </Link>
      );
    }

    return (
      <Link href={href} onClick={(e) => {
        if ((window as any).isSketchPlanDirty) {
          if (!window.confirm("⚠️ WARNING: You have UNSAVED changes! ⚠️\n\nClick 'Cancel' to STAY on this page so you can save your work.\nClick 'OK' to DISCARD your changes and exit.")) {
            e.preventDefault();
            return;
          }
        }
      }}>
        <span
          className={cn(
            isCollapsed
              ? "w-10 h-10 flex items-center justify-center mx-auto rounded-lg transition-colors mb-2 cursor-pointer group relative"
              : "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors mb-2 cursor-pointer group relative",
            isHidden && "opacity-40 grayscale-[0.5]"
          )}
          style={{
            backgroundColor: isActive
              ? theme.subItemActiveBg
              : (isHovered ? theme.subItemHoverBg : 'transparent'),
            color: isActive ? theme.subItemActiveText : theme.subItemText,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={closeSidebarOnMobile}
          title={isCollapsed ? label : undefined}
        >
          <Icon
            className="h-4 w-4 shrink-0 transition-colors"
            style={{
              color: isActive ? theme.iconActive : theme.iconDefault
            }}
          />
          {!isCollapsed && <span className="truncate flex-1">{label}</span>}
          {!isCollapsed && count !== undefined && count > 0 && (
            <Badge variant="destructive" className="ml-auto pointer-events-none">
              {count}
            </Badge>
          )}
          {!isCollapsed && badge && !count && <span className="ml-auto">{badge}</span>}

          {!isCollapsed && (
            <button
              onClick={(e) => toggleHideItem(e, id)}
              className={cn(
                "p-1 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-all",
                isEditMode ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
              )}
              title={isHidden ? "Unhide" : "Hide"}
            >
              {isHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
          )}
        </span>
      </Link>
    );
  };

  const AccordionHeader = ({
    sectionKey,
    icon: Icon,
    label,
    count
  }: {
    sectionKey: string;
    icon: any;
    label: string;
    count?: number;
  }) => {
    const isOpen = openSection === sectionKey;
    const [isHovered, setIsHovered] = useState(false);
    return (
      <button
        onClick={() => toggleSection(sectionKey)}
        title={isCollapsed ? label : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          isCollapsed
            ? "w-10 h-10 flex items-center justify-center mx-auto rounded-lg border transition-all duration-200 hover:bg-white hover:shadow-md"
            : "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left group h-10 border transition-all duration-200 hover:bg-white hover:shadow-md",
          isOpen && "bg-white shadow-md"
        )}
        style={{
          backgroundColor: isDark
            ? (isOpen ? theme.headerActiveBg : (isHovered ? theme.headerHoverBg : 'transparent'))
            : undefined,
          borderColor: isOpen
            ? (isDark ? theme.border : '#6366f133')
            : (isHovered ? theme.border : 'transparent'),
          color: theme.headerText,
        }}
      >
        <Icon
          className="h-4 w-4 flex-shrink-0 transition-colors"
          style={{
            color: isOpen ? theme.iconActive : theme.iconDefault
          }}
        />
        {!isCollapsed && (
          <>
            <span className="flex-1 text-[13px] font-medium truncate">{label}</span>
            {count !== undefined && count > 0 && (
              <span className="bg-[#EF4444] text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                {count}
              </span>
            )}
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''
                }`}
              style={{
                color: isOpen ? theme.iconActive : theme.iconDefault
              }}
            />
          </>
        )}
      </button>
    );
  };

  const AccordionContent = ({
    sectionKey,
    children
  }: {
    sectionKey: string;
    children: React.ReactNode;
  }) => {
    const isOpen = openSection === sectionKey;
    return (
      <div
        className="overflow-hidden transition-all"
        style={{
          paddingLeft: isCollapsed ? 0 : '20px',
          marginTop: isOpen ? '2px' : 0,
          marginBottom: isOpen ? '4px' : 0,
          maxHeight: isOpen ? '600px' : '0px',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateY(0)' : 'translateY(-4px)',
          transition: `max-height 250ms ease, opacity 250ms ease, transform ${isOpen ? '200ms ease-out' : '150ms ease-in'}, margin 250ms ease`
        }}
      >
        <div className="space-y-0.5 py-1">
          {children}
        </div>
      </div>
    );
  };
  // ----------------------------

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  /**
   * A top-level sidebar row that looks exactly like an AccordionHeader but is a plain
   * link — no chevron, no expand/collapse, no sub-item underneath. Used for sections
   * that are really one page with tabs inside it (BOQ / Projects and Procurement).
   */
  const DirectSectionLink = ({
    href,
    icon: Icon,
    label,
    activePaths,
    count,
    active,
  }: {
    href: string;
    icon: any;
    label: string;
    activePaths?: string[];
    count?: number;
    // When provided, overrides the normal activePaths/href match — used when
    // "active" depends on more than the pathname (e.g. a ?tab= query param).
    active?: boolean;
  }) => {
    const [isHovered, setIsHovered] = useState(false);
    const isActive = active !== undefined
      ? active
      : activePaths
        ? activePaths.some((p) => location.startsWith(p))
        : location === href;

    return (
      <Link
        href={href}
        onClick={(e) => {
          if ((window as any).isSketchPlanDirty) {
            if (!window.confirm("⚠️ WARNING: You have UNSAVED changes! ⚠️\n\nClick 'Cancel' to STAY on this page so you can save your work.\nClick 'OK' to DISCARD your changes and exit.")) {
              e.preventDefault();
              return;
            }
          }
          closeSidebarOnMobile();
        }}
      >
        <span
          title={isCollapsed ? label : undefined}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            isCollapsed
              ? "w-10 h-10 flex items-center justify-center mx-auto rounded-lg border transition-all duration-200 hover:bg-white hover:shadow-md cursor-pointer"
              : "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left group h-10 border transition-all duration-200 hover:bg-white hover:shadow-md cursor-pointer",
            isActive && "bg-white shadow-md"
          )}
          style={{
            backgroundColor: isDark
              ? (isActive ? theme.headerActiveBg : (isHovered ? theme.headerHoverBg : 'transparent'))
              : undefined,
            borderColor: isActive
              ? (isDark ? theme.border : '#6366f133')
              : (isHovered ? theme.border : 'transparent'),
            color: theme.headerText,
          }}
        >
          <Icon
            className="h-4 w-4 flex-shrink-0 transition-colors"
            style={{ color: isActive ? theme.iconActive : theme.iconDefault }}
          />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-[13px] font-medium truncate">{label}</span>
              {count !== undefined && count > 0 && (
                <span className="bg-[#EF4444] text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                  {count}
                </span>
              )}
            </>
          )}
        </span>
      </Link>
    );
  };

  // Custom permission state (dynamic access control) is now centralized in DataContext
  const { customModules, isCustomManaged, permsLoaded, refreshPermissions } = useData();

  // Helper: returns true if the module is allowed.
  // Full access for admin and software_team; others filter if managed by admin.
  const isVisible = (moduleKey: string, defaultCondition: boolean): boolean => {
    if (user?.role === 'client') return false; // Clients don't use standard internal modules
    if (user?.role === 'admin' || user?.role === 'software_team') return true;
    // Wait for permissions to load before showing items for non-admin users.
    // This prevents the flicker where items appear (default) then disappear (custom).
    if (!permsLoaded) return false;
    if (user?.role === 'pre_sales' && moduleKey === 'dashboard') return true;
    if (isCustomManaged) return customModules.has(moduleKey);
    return defaultCondition;
  };

  useEffect(() => {
    const handlePermissionsUpdated = (e: any) => {
      if (e.detail?.userId === user?.id) {
        refreshPermissions();
      }
    };
    window.addEventListener('permissions_updated', handlePermissionsUpdated);
    return () => window.removeEventListener('permissions_updated', handlePermissionsUpdated);
  }, [user?.id, refreshPermissions]);



  // Fetch pending counts from API
  const [pendingShopCount, setPendingShopCount] = useState(0);
  const [pendingMaterialCount, setPendingMaterialCount] = useState(0);
  const [pendingProductCount, setPendingProductCount] = useState(0);
  const [pendingBomCount, setPendingBomCount] = useState(0);
  const [pendingBoqCount, setPendingBoqCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  // Fetch subcategories from API
  useEffect(() => {
    const loadSubcategories = async () => {
      try {
        setLoadingSubcategories(true);
        const response = await apiFetch("/api/sidebar-subcategories", {
          headers: {},
        });
        if (response.ok) {
          const data = await response.json();
          const items = data.subcategories || [];

          // Map subcategories to items with icons
          const mappedItems = items.map((item: SubcategoryItem) => ({
            ...item,
            icon: iconMap[item.icon] || Layers,
          }));

          setSubcategories(mappedItems);
        }
      } catch (error) {
        console.warn("Failed to load subcategories:", error);
        // Fallback to predefined items if API fails
        setSubcategories(estimatorItems.map(item => ({
          id: item.label,
          name: item.label,
          href: item.href,
          icon: Object.entries(iconMap).find(([_, icon]) => icon === item.icon)?.[0] || "Layers",
          category: "Estimators",
        })));
      } finally {
        setLoadingSubcategories(false);
      }
    };

    loadSubcategories();

    // Refresh subcategories every 30 seconds to pick up new database entries
    const interval = setInterval(loadSubcategories, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch('/alerts');
        if (!res || !res.ok) return setAlertsCount(0);
        const data = await res.json();
        if (cancelled) return;
        const list = data?.alerts || data || [];
        setAlertsCount(Array.isArray(list) ? list.length : 0);
      } catch (e) {
        console.warn('load alerts count failed', e);
        setAlertsCount(0);
      }
    };

    load();
    const iv = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/shops-pending-approval");
        if (res.ok) {
          const data = await res.json();
          setPendingShopCount(
            (data?.shops || []).filter((r: any) => r.status === "pending")
              .length,
          );
        }
      } catch (e) {
        console.warn("load shop count failed", e);
      }
    })();
  }, []);

  // fetch pending product approvals count
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch("/api/product-approvals");
        if (!res || !res.ok) return setPendingProductCount(0);
        const data = await res.json();
        if (cancelled) return;
        setPendingProductCount((data?.approvals || []).filter((a: any) => a.status === "pending").length || 0);
      } catch (e) {
        console.warn("load product approval count failed", e);
        setPendingProductCount(0);
      }
    };

    load();
    const iv = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // fetch pending BOM and BOQ approvals counts
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch("/api/bom-approvals");
        if (!res || !res.ok) {
          setPendingBomCount(0);
          setPendingBoqCount(0);
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        const allApprovals = data?.approvals || [];
        const isPending = (a: any) => a.status === "pending_approval" || a.status === "submitted" || a.status === "edit_requested";

        setPendingBomCount(allApprovals.filter((a: any) => isPending(a) && (a.type === 'bom' || !a.type)).length);
        setPendingBoqCount(allApprovals.filter((a: any) => isPending(a) && a.type === 'boq').length);
      } catch (e) {
        console.warn("load BOM/BOQ approval counts failed", e);
        setPendingBomCount(0);
        setPendingBoqCount(0);
      }
    };

    load();
    const iv = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // derive material pending count from central store (keeps counts consistent)
  useEffect(() => {
    try {
      if (!materialApprovalRequests) {
        setPendingMaterialCount(0);
        return;
      }
      setPendingMaterialCount(
        (materialApprovalRequests || []).filter(
          (r: any) => r.status === "pending",
        ).length,
      );
    } catch (e) {
      console.warn("compute material pending count failed", e);
      setPendingMaterialCount(0);
    }
  }, [materialApprovalRequests]);

  // derive message count from store-loaded support messages (prefer unread count)
  useEffect(() => {
    try {
      if (!supportMessages) {
        setMessageCount(0);
        return;
      }
      // count unread messages for admin view, otherwise count messages sent by the user
      const unread = (supportMessages || []).filter(
        (m: any) => m.is_read === false,
      ).length;
      setMessageCount(unread || (supportMessages || []).length);
    } catch (e) {
      console.warn("compute message count failed", e);
      setMessageCount(0);
    }
  }, [supportMessages]);

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const isAdminOrSoftware =
    user?.role === "admin" || user?.role === "software_team";
  const isPreSales = user?.role === "pre_sales";
  const isContractor = user?.role === "contractor";
  const isAdminOrSoftwareOrPurchaseTeam =
    user?.role === "admin" ||
    user?.role === "software_team" ||
    user?.role === "purchase_team";
  const isSupplierOrPurchase =
    user?.role === "supplier" || user?.role === "purchase_team";
  const isPurchaseTeam = user?.role === "purchase_team";
  const isProductManager = user?.role === "product_manager";
  const isFinance = user?.role === "finance_team";
  const isClient = user?.role === "user";
  const isVoltAmpele = user?.username === "VoltAmpele@gmail.com";

  // ✅ Supplier approval visible ONLY for admin
  const isAdminOnly = user?.role === "admin";

  // ✅ Create BOQ and Create Project visible for ADMIN, SOFTWARE TEAM and PRE_SALES
  const canCreateBOQAndProject =
    user?.role === "admin" || user?.role === "software_team" || isPreSales;

  const getAdminTab = () => {
    if (typeof window === "undefined") return null;
    return new URL(window.location.href).searchParams.get("tab");
  };

  const currentAdminTab = getAdminTab();

  const filteredEstimators = estSearch
    ? subcategories.filter((item: any) =>
      (item.name || item.label).toLowerCase().includes(estSearch.toLowerCase()),
    )
    : subcategories;

  return (
    <>
      {/* Mobile/Desktop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Toggle Button (Trigger) when closed */}
      {!isOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 bg-background shadow-sm border hover:bg-accent"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 transform transition-all duration-300 ease-in-out flex flex-col shadow-xl md:shadow-none border-r",
          isCollapsed ? "w-16" : "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
        }}
      >
        <div
          className={cn("flex h-16 items-center justify-between border-b transition-all", isCollapsed ? "px-2 flex-col justify-center gap-1 py-1" : "px-4")}
          style={{
            backgroundColor: theme.bg,
            borderColor: theme.border,
          }}
        >
          {!isCollapsed ? (
            <h1 className="text-xl font-bold tracking-tight font-heading truncate">
              <span style={{ color: theme.logoBuild }}>BUILD</span>
              <span style={{ color: theme.logoEstimate }}>ESTIMATE</span>
            </h1>
          ) : (
            <h1 className="text-sm font-bold tracking-tight font-heading text-center shrink-0">
              <span style={{ color: theme.logoBuild }}>B</span>
              <span style={{ color: theme.logoEstimate }}>E</span>
            </h1>
          )}
          <div className={cn("flex items-center gap-1", isCollapsed && "flex-col w-full")}>
            <Button
              variant="ghost"
              size="icon"
              className={cn("shrink-0", isCollapsed ? "h-6 w-6" : "h-8 w-8")}
              style={{
                color: isEditMode ? (isDark ? '#FFFFFF' : '#6366f1') : theme.headerText,
                backgroundColor: isEditMode
                  ? theme.headerActiveBg
                  : (settingsHover ? theme.headerHoverBg : "transparent"),
              }}
              onMouseEnter={() => setSettingsHover(true)}
              onMouseLeave={() => setSettingsHover(false)}
              onClick={toggleEditMode}
              title={isEditMode ? "Exit Edit Mode" : "Manage Sidebar items"}
            >
              <Settings className={cn("transition-transform duration-500", isCollapsed ? "h-3 w-3" : "h-4 w-4", isEditMode && "rotate-90")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("shrink-0", isCollapsed ? "h-6 w-6" : "h-8 w-8")}
              style={{
                color: theme.headerText,
                backgroundColor: collapseHover ? theme.headerHoverBg : "transparent",
              }}
              onMouseEnter={() => setCollapseHover(true)}
              onMouseLeave={() => setCollapseHover(false)}
              onClick={() => {
                const nextVal = !isCollapsed;
                setIsCollapsed(nextVal);
                localStorage.setItem("sidebar_collapsed", String(nextVal));
              }}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <Menu className="h-3 w-3" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                style={{
                  color: theme.headerText,
                  backgroundColor: themeHover ? theme.headerHoverBg : "transparent",
                }}
                onMouseEnter={() => setThemeHover(true)}
                onMouseLeave={() => setThemeHover(false)}
                onClick={toggleTheme}
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {/* Edit Mode Controls */}
          {isEditMode && (
            <div
              className="px-3 py-2 mb-4 rounded-md border shadow-inner"
              style={{
                backgroundColor: isDark ? theme.headerActiveBg : '#6366f10a',
                borderColor: theme.border,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] font-black uppercase tracking-tight"
                  style={{ color: theme.labelText }}
                >
                  Manage Sidebar
                </span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-sidebar-primary/30 text-sidebar-primary font-bold">Edit Mode</Badge>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] w-full justify-start font-bold"
                  style={{
                    borderColor: theme.border,
                    color: theme.headerText,
                    backgroundColor: isDark ? theme.headerHoverBg : '#ffffff',
                  }}
                  onClick={resetHiddenItems}
                >
                  <RotateCcw className="h-3 w-3 mr-2" style={{ color: theme.iconDefault }} /> Reset All Hidden
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-[10px] w-full font-bold"
                  style={{
                    backgroundColor: isDark ? '#1E40AF' : '#6366f1',
                    color: '#ffffff',
                  }}
                  onClick={() => setIsEditMode(false)}
                >
                  <CheckCircle2 className="h-3 w-3 mr-2 text-white" /> Finish Editing
                </Button>
              </div>
            </div>
          )}

          {/* Overview Section */}
          {/* "Dashboard" / "Project Dashboard" / "Alerts" / "Access Control" / "Spy" used to
              be five separate links here. They're now one "Overview" link that opens on the
              first page the user can access; all five are tabs inside that same flow (see
              OverviewTabBar, rendered on the destination pages), in this order:
              Dashboard → Project Dashboard → Alerts → Access Control → Spy (Activity Log).
              Visibility below mirrors the original per-item conditions (isVisible where the
              original item called it, plain role checks where it didn't) so admin-managed
              per-user permissions keep working exactly as before for whichever a user has. */}
          {!isVoltAmpele && (() => {
            const canSeeDashboard = isVisible('dashboard', !isContractor && user?.role !== "supplier" && !isProductManager);
            const canSeeProjectDashboard = isVisible('project_dashboard', isAdminOrSoftware);
            const canSeeAlerts = isVisible('alerts', isAdminOnly);
            // Access Control and Spy were plain role checks in the old sidebar item
            // (no isVisible/custom-permission gating), so they stay that way here.
            const canSeeAccessControl = isAdminOnly;
            const canSeeSpy = isAdminOrSoftware;
            const canSeeOverview = isPreSales || canSeeDashboard || canSeeProjectDashboard || canSeeAlerts || canSeeAccessControl || canSeeSpy;

            if (!canSeeOverview) return null;

            const overviewHref = canSeeDashboard || isPreSales
              ? "/dashboard"
              : canSeeProjectDashboard
                ? "/project-dashboard"
                : canSeeAlerts
                  ? "/admin/dashboard?tab=alerts"
                  : canSeeAccessControl
                    ? "/admin/access-control"
                    : "/admin/spy";

            // /admin/dashboard is shared with other sidebar sections (materials, shops,
            // approvals, messages, etc. via ?tab=), so only count it as "Overview" when
            // the tab is actually alerts (or unset, i.e. the plain dashboard tab).
            const currentTab = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("tab");
            const isOnAdminDashboardOverviewTab = location === "/admin/dashboard" && (currentTab === "alerts" || !currentTab);
            const isOverviewActive =
              location.startsWith("/dashboard") ||
              location.startsWith("/project-dashboard") ||
              location.startsWith("/admin/spy") ||
              location.startsWith("/admin/access-control") ||
              isOnAdminDashboardOverviewTab;

            return (
              <div className="space-y-0.5">
                <DirectSectionLink
                  href={overviewHref}
                  icon={LayoutDashboard}
                  label="Overview"
                  count={alertsCount > 0 ? alertsCount : undefined}
                  active={isOverviewActive}
                />
              </div>
            );
          })()}

          {/* Creations Section */}
          {/* "Create Item" / "Create Product" / "Create Vendor Category" / "Create Project"
              used to be four separate links here. They're now one "Creations" link that
              opens on the Item tab; Product, Vendor Category and Create Project are tabs
              inside that same flow (see CreationsTabBar, rendered on the destination pages).
              "Create Shops" (formerly "Manage Shops" in the Management section below) has
              also moved in here as a tab, next to Vendor Category — same href/permission key
              ("manage_shops"), just renamed and relocated.
              "Sketch a Plan" has moved out — it's now the first tab of BOQ / Projects
              (see BoqTabBar) instead of living under Creations.
              Since only one clickable link remains here, this is now a plain direct link
              (like Management / Communication below) instead of an accordion: clicking
              "Creations" itself opens the flow, no separate "Create" sub-item needed.
              Visibility below is the OR of the five original per-module checks (still calling
              isVisible with each original module key) so admin-managed per-user permissions
              keep working exactly as before for whichever of the five a user has. */}
          {(() => {
            const canSeeCreateItem = isVisible('create_item', isAdminOrSoftwareOrPurchaseTeam && !isPreSales && !isContractor && !isProductManager && !isVoltAmpele);
            const canSeeCreateProduct = isVisible('create_product', isAdminOrSoftwareOrPurchaseTeam || isPreSales || isProductManager || isVoltAmpele);
            const canSeeCreateVendorCategory = isVisible('create_vendor_category', isAdminOrSoftwareOrPurchaseTeam && !isPreSales && !isContractor && !isProductManager);
            const canSeeCreateShops = isVisible('manage_shops', isAdminOrSoftware && !isPreSales && !isContractor && !isProductManager);
            const canSeeCreateProject = isVisible('create_project', canCreateBOQAndProject && !isProductManager && !isVoltAmpele);
            const canSeeCreate = canSeeCreateItem || canSeeCreateProduct || canSeeCreateVendorCategory || canSeeCreateShops || canSeeCreateProject;

            if (!canSeeCreate) return null;

            const creationsHref = canSeeCreateProject
              ? "/create-project"
              : canSeeCreateItem
                ? "/admin/dashboard?tab=materials"
                : canSeeCreateProduct
                  ? "/admin/dashboard?tab=create-product"
                  : canSeeCreateVendorCategory
                    ? "/admin/vendor-categories"
                    : "/admin/dashboard?tab=shops";

            return (
              <div className="space-y-0.5">
                <DirectSectionLink
                  href={creationsHref}
                  icon={PlusCircle}
                  label="Creations"
                  active={
                    (location.startsWith("/admin/dashboard") && ["materials", "create-product", "shops"].includes(currentAdminTab || "")) ||
                    location.startsWith("/admin/vendor-categories") ||
                    location.startsWith("/create-project")
                  }
                />
              </div>
            );
          })()}

          {/* Management Section */}
          {/* "Manage Product" / "Manage Materials" / "Manage Categories" / "Bulk Upload"
              used to be four separate links here (plus "Manage Shops", now moved to the
              Creations section as "Create Shops" — see above). They're now one
              "Management" link that opens on the first page the user can access; the
              remaining three are tabs inside that same flow (see ManagementTabBar,
              rendered on the destination pages).
              "Bulk Upload" is hidden for now — its visibility check and activePaths
              entry are commented out below rather than removed, so it can be brought
              back by uncommenting (and re-adding its entry in ManagementTabBar.tsx).
              Visibility below is the OR of the remaining per-module checks (still
              calling isVisible with each original module key) so admin-managed per-user
              permissions keep working exactly as before for whichever a user has. */}
          {(() => {
            const canSeeManageProduct = isVisible('manage_product', isAdminOrSoftware);
            const canSeeManageMaterials = isVisible('manage_materials', isAdminOrSoftware && !isPreSales && !isContractor && !isProductManager);
            const canSeeManageCategories = isVisible('manage_categories', isAdminOrSoftware && !isPreSales && !isContractor && !isProductManager);
            // const canSeeBulkUpload = isVisible('bulk_upload', isAdminOrSoftware && !isPreSales && !isContractor && !isProductManager);
            const canSeeManagement = canSeeManageProduct || canSeeManageMaterials || canSeeManageCategories;

            if (!canSeeManagement) return null;

            const managementHref = canSeeManageProduct
              ? "/admin/manage-product"
              : canSeeManageMaterials
                ? "/admin/manage-materials"
                : "/admin/manage-categories";

            // No chevron / no sub-item: the section header itself opens the page, and
            // Manage Product / Manage Materials / Manage Categories are tabs inside it
            // (see ManagementTabBar).
            return (
              <div className="space-y-0.5">
                <DirectSectionLink
                  href={managementHref}
                  icon={Settings}
                  label="Management"
                  activePaths={["/admin/manage-product", "/admin/manage-materials", "/admin/manage-categories"]}
                />
              </div>
            );
          })()}

          {/* BOQ / Projects Section */}
          {/* "Generate BOM" / "Generate PO" / "Finalize BOQ" used to be three separate links
              here. They're now one "BOQ / Projects" link that opens on the Sketch a Plan tab
              (the first tab in BoqTabBar); BOM, BOQ and PO are the other tabs inside that same
              flow (see BoqTabBar, rendered on the destination pages).
              Visibility below is the OR of the three original per-module checks (still calling
              isVisible with each original module key) so admin-managed per-user permissions
              keep working exactly as before for whichever of the three a user has. */}
          {(() => {
            const canSeeGenerateBom = isVisible('generate_bom', isAdminOrSoftware || isPreSales || isProductManager || isPurchaseTeam || isFinance);
            const canSeeGeneratePo = isVisible('generate_po', (isAdminOrSoftware || isPreSales || isProductManager || isPurchaseTeam) && !isProductManager);
            const canSeeFinalizeBoq = isVisible('finalize_boq', isAdminOrSoftware || isFinance);
            const canSeeBoq = canSeeGenerateBom || canSeeGeneratePo || canSeeFinalizeBoq;

            if (!canSeeBoq) return null;

            // No chevron / no sub-item: the section header itself opens the page,
            // and Sketch a Plan / BOM / BOQ / PO are tabs inside it (see BoqTabBar).
            return (
              <div className="space-y-0.5">
                <DirectSectionLink
                  href="/sketch-plans"
                  icon={FileStack}
                  label="BOQ / Projects"
                  activePaths={["/sketch-plans", "/create-bom", "/finalize-bom", "/generate-po"]}
                />
              </div>
            );
          })()}

          {/* Site Management Section */}
          {/* Only ever had one item (Site Reports), so this is a plain direct link now
              instead of an accordion — no chevron, no sub-item, clicking it opens
              Site Reports straight away. */}
          {(user?.role === "admin" || user?.role === "software_team" || user?.role === "site_engineer") && (
            <div className="space-y-0.5">
              <DirectSectionLink
                href="/site-reports"
                icon={Building2}
                label="Site Management"
                activePaths={["/site-reports"]}
              />
            </div>
          )}

          {/* Procurement Section */}
          {/* "Purchase Orders" / "Delivery Tracker" / "Form Builder" / "Tenders" /
              "Raise PO Request" / "My Requests" (formerly its own "PO Requests" section)
              used to be six separate links here. They're now one "Procurement" link that
              opens on the first page the user can access; all six are tabs inside that
              same flow (see ProcurementTabBar, rendered on the destination pages), in
              this order:
              Purchase Orders → Delivery Tracker → Form Builder → Tenders →
              Raise PO Request → My Requests.
              Visibility below is the OR of the six original per-module checks (still
              calling isVisible with each original module key) so admin-managed per-user
              permissions keep working exactly as before for whichever of the six a user
              has. */}
          {(() => {
            const canSeePurchaseOrders = isVisible('purchase_orders', isAdminOrSoftware || isPurchaseTeam);
            const canSeeDeliveryTracker = isVisible('delivery_tracker', isAdminOrSoftware || isPurchaseTeam || user?.role === 'site_engineer');
            const canSeeFormBuilder = isVisible('form_builder', isAdminOrSoftware || isPurchaseTeam || isPreSales);
            const canSeeTenders = isVisible('tenders', isAdminOrSoftware || isPurchaseTeam);
            const canSeeRaisePoRequest = isVisible('raise_po_request', !isVoltAmpele && !isContractor && user?.role !== "supplier");
            const canSeeMyPoRequests = isVisible('my_po_requests', !isVoltAmpele && !isContractor && user?.role !== "supplier");
            const canSeeProcurement = canSeePurchaseOrders || canSeeDeliveryTracker || canSeeFormBuilder || canSeeTenders || canSeeRaisePoRequest || canSeeMyPoRequests;

            if (!canSeeProcurement) return null;

            // Land on the first tab the user is actually allowed to open.
            const procurementHref = canSeePurchaseOrders
              ? "/purchase-orders"
              : canSeeDeliveryTracker
                ? "/delivery-tracker"
                : canSeeFormBuilder
                  ? "/admin/form-builder"
                  : canSeeTenders
                    ? "/admin/tenders"
                    : canSeeRaisePoRequest
                      ? "/raise-po-request"
                      : "/my-po-requests";

            // No chevron / no sub-item: the section header itself opens the page, and
            // Purchase Orders / Delivery Tracker / Form Builder / Tenders / Raise PO
            // Request / My Requests are tabs inside it (see ProcurementTabBar).
            return (
              <div className="space-y-0.5">
                <DirectSectionLink
                  href={procurementHref}
                  icon={Truck}
                  label="Procurement"
                  activePaths={["/purchase-orders", "/delivery-tracker", "/admin/form-builder", "/admin/tenders", "/raise-po-request", "/my-po-requests"]}
                />
              </div>
            );
          })()}

          {/* Approvals Section — hidden from sidebar per request; the header's
              "Approvals" dropdown now covers all of these (including PO Approvals,
              added there for parity). Block kept intact, just not rendered. */}
          {false && (isVisible('shop_approvals', (isAdminOrSoftwareOrPurchaseTeam || isProductManager) && !isPreSales && !isContractor && !isProductManager) ||
            isVisible('material_approvals', (isAdminOrSoftwareOrPurchaseTeam || isProductManager) && !isPreSales && !isContractor && !isProductManager) ||
            isVisible('supplier_approvals', (isAdminOrSoftwareOrPurchaseTeam || isProductManager) && !isPreSales && !isContractor && isAdminOnly) ||
            isVisible('product_approvals', (isAdminOrSoftwareOrPurchaseTeam || isProductManager) && !isPreSales && !isContractor && (isAdminOrSoftware || isProductManager)) ||
            isVisible('bom_approvals', (isAdminOrSoftwareOrPurchaseTeam || isProductManager) && !isPreSales && !isContractor && isAdminOrSoftware) ||
            isVisible('boq_approvals', isAdminOrSoftware) ||
            isVisible('po_approvals', isAdminOrSoftware)) && (
              <div className="space-y-0.5">
                <AccordionHeader sectionKey="approvals" icon={ClipboardCheck} label="Approvals" count={pendingShopCount + pendingMaterialCount + pendingProductCount + pendingBomCount + pendingBoqCount} />
                <AccordionContent sectionKey="approvals">
                  <SidebarNavItem id="shop_approvals" href="/admin/dashboard?tab=approvals" icon={ShieldAlert} label="Shop Approvals" count={pendingShopCount} adminTab="approvals" condition={!isProductManager} />
                  <SidebarNavItem id="material_approvals" href="/admin/dashboard?tab=material-approvals" icon={CheckCircle2} label="Material Approvals" count={pendingMaterialCount} adminTab="material-approvals" condition={!isProductManager} />
                  <SidebarNavItem id="supplier_approvals" href="/admin/suppliers" icon={Users} label="Supplier Approvals" condition={isAdminOnly} />
                  <SidebarNavItem id="product_approvals" href="/admin/product-approvals" icon={FolderKanban} label="Product Approvals" count={pendingProductCount} condition={isAdminOrSoftware || isProductManager} />
                  <SidebarNavItem id="bom_approvals" href="/admin/bom-approvals" icon={CheckCircle2} label="BOM Approvals" count={pendingBomCount} condition={isAdminOrSoftware} />
                  <SidebarNavItem id="boq_approvals" href="/admin/boq-approvals" icon={CheckCircle2} label="BOQ Approvals" count={pendingBoqCount} condition={isAdminOrSoftware} />
                  <SidebarNavItem id="po_approvals" href="/po-approvals" icon={ClipboardCheck} label="PO Approvals" condition={isAdminOrSoftware} />
                  {/* Hidden from sidebar per request; routes still exist, just not linked here.
                  <SidebarNavItem id="purchase_team_bom_approvals" href="/admin/purchase-team-bom-approvals" icon={CheckCircle2} label="Purchase Team BOM Approvals" condition={isAdminOrSoftware || isPurchaseTeam} />
                  <SidebarNavItem id="proposal_approvals" href="/admin/proposal-approvals" icon={ClipboardCheck} label="Proposal Approvals" condition={isAdminOrSoftware} />
                  */}
                </AccordionContent>
              </div>
            )}

          {/* Storage Section */}
          {/* "Archive" / "Trash" used to be two separate links here. They're now one
              "Storage" link that opens on Archive; both are tabs inside that same flow
              (see StorageTabBar, rendered on the destination pages). Both were
              admin/software_team only in the old sidebar item, so that stays a plain
              role check (no isVisible/custom-permission gating) here too. */}
          {(user?.role === "admin" || user?.role === "software_team") && (
            <div className="space-y-0.5">
              <DirectSectionLink
                href="/admin/archive"
                icon={Archive}
                label="Storage"
                activePaths={["/admin/archive", "/admin/trash"]}
              />
            </div>
          )}

          {/* Communication Section */}
          {/* Only ever had one item (Messages), so this is a plain direct link now
              instead of an accordion — no chevron, no sub-item, clicking it opens
              Messages straight away. */}
          {isVisible('support_chat', !isVoltAmpele && isAdminOrSoftwareOrPurchaseTeam && !isPreSales && !isContractor && !isProductManager) && (
            <div className="space-y-0.5">
              <DirectSectionLink
                href="/admin/dashboard?tab=messages"
                icon={MessageSquare}
                label="Communication"
                count={messageCount}
                active={location.startsWith("/admin/dashboard") && currentAdminTab === "messages"}
              />
            </div>
          )}

          {/* Supplier Portal Section */}
          {!isVoltAmpele && !isPreSales && !isContractor && user?.role === "supplier" && (
            <>
              <div
                className="px-3 mb-2 mt-4 text-xs font-semibold uppercase tracking-wider"
                style={{ color: theme.labelText }}
              >
                Supplier Portal
              </div>
              <SidebarNavItem
                id="supplier_dashboard"
                href="/dashboard"
                icon={LayoutDashboard}
                label="Dashboard"
                isSubItem={false}
              />
              <SidebarNavItem
                id="supplier_tenders"
                href="/supplier/tenders"
                icon={ShoppingCart}
                label="Tenders"
                isSubItem={false}
              />
              <SidebarNavItem
                id="supplier_manage_materials"
                href="/supplier/materials"
                icon={Package}
                label="Manage Materials"
                isSubItem={false}
              />
              {/* TEMPORARILY HIDDEN:
              <SidebarNavItem
                id="supplier_delivery_tracker"
                href="/delivery-tracker"
                icon={Truck}
                label="Delivery Tracker"
                isSubItem={false}
              />
              */}
              <SidebarNavItem
                id="supplier_sketch_plan"
                href="/sketch-plans"
                icon={Hammer}
                label="Sketch a Plan"
                isSubItem={false}
              />
              <SidebarNavItem
                id="supplier_manage_product"
                href="/admin/manage-product"
                icon={Package}
                label="Manage Product"
                isSubItem={false}
              />
              <SidebarNavItem
                id="supplier_proposal"
                href="/proposal"
                icon={FileText}
                label="Proposal"
                isSubItem={false}
              />
              <SidebarNavItem
                id="supplier_support"
                href="/supplier/support"
                icon={MessageSquare}
                label="Messages"
                isSubItem={false}
              />
            </>
          )}

          {/* Client Portal Section */}
          {user?.role === "client" && (
            <>
              <div
                className="px-3 mb-2 mt-4 text-xs font-semibold uppercase tracking-wider"
                style={{ color: theme.labelText }}
              >
                Client Portal
              </div>
              <SidebarNavItem
                id="client_tenders"
                href="/client/tenders"
                icon={ShoppingCart}
                label="Tenders"
                isSubItem={false}
              />
            </>
          )}

          {/* Other Resources Section */}
          {/* "Subscription" / "User Manual" used to be two separate links here.
              They're now one "Resources" link that opens on Subscription (falling
              back to User Manual if that's the only one visible); both are tabs
              inside that same flow (see ResourcesTabBar, rendered on the
              destination pages). Visibility below is the OR of the two original
              per-module checks so admin-managed per-user permissions keep working
              exactly as before for whichever of the two a user has. */}
          {(() => {
            const canSeeSubscription = isVisible('subscription', !isVoltAmpele && !isPreSales && !isContractor);
            const canSeeUserManual = isVisible('user_manual', !isVoltAmpele && !isPreSales && !isContractor);
            if (!(canSeeSubscription || canSeeUserManual)) return null;

            return (
              <div className="space-y-0.5 mt-2">
                <DirectSectionLink
                  href={canSeeSubscription ? "/subscription" : "/user-manual"}
                  icon={BookOpen}
                  label="Resources"
                  activePaths={["/subscription", "/user-manual"]}
                />
              </div>
            );
          })()}

        </nav>

        <div
          className={cn("border-t transition-all", isCollapsed ? "p-2" : "p-4")}
          style={{
            backgroundColor: theme.userBg,
            borderColor: theme.border,
          }}
        >
          <div className="flex items-center gap-3 mb-3 justify-start">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center font-bold shrink-0"
              style={{
                backgroundColor: isDark ? theme.headerActiveBg : '#6366f11a',
                color: isDark ? theme.userName : '#6366f1',
              }}
            >
              {((user as any)?.fullName || (user as any)?.username || "")?.charAt(0)?.toUpperCase() || "U"}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate" style={{ color: theme.userName }}>
                  {(user as any)?.fullName || (user as any)?.username || "Guest"}
                </span>
                <span className="text-xs truncate capitalize" style={{ color: theme.userEmail }}>
                  {user?.role?.replace("_", " ") || "Visitor"}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={cn(
              isCollapsed
                ? "w-10 h-10 flex items-center justify-center mx-auto rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer border-none"
                : "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer border-none"
            )}
            style={{
              background: isDark ? 'rgba(255,255,255,0.1)' : '#FEE2E2',
              color: isDark ? '#FCA5A5' : '#EF4444',
            }}
            title={isCollapsed ? "Log Out" : undefined}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background =
                isDark ? 'rgba(255,255,255,0.2)' : '#FECACA';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background =
                isDark ? 'rgba(255,255,255,0.1)' : '#FEE2E2';
            }}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!isCollapsed && "Log Out"}
          </button>
        </div>
      </aside>
    </>
  );
}