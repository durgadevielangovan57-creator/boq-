import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Chatbot } from "../ui/Chatbot";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="no-print">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      </div>
      <main className={cn(
        "min-h-screen transition-all duration-300 ease-in-out print:pl-0",
        sidebarOpen ? "md:pl-64" : "pl-0"
      )}>
        <Header />
        <div className="w-full p-4 md:p-8 pt-4">
          {children}
        </div>
      </main>
      <div className="no-print">
        <Chatbot />
      </div>
    </div>
  );
}

