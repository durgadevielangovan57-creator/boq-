import React, { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { History, Loader2, Info, ArrowUpRight } from "lucide-react";
import apiFetch from "@/lib/api";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface HistoricalEntry {
  projectName: string;
  date: string;
  supplyRate: string | number | null;
  labourRate: string | number | null;
  qty: string | number | null;
  total: string | number | null;
  versionStatus?: string;
}

interface RateSuggestionPopoverProps {
  productId: string;
  columnName: string;
  onSelect: (value: string) => void;
  triggerClassName?: string;
}

export const RateSuggestionPopover: React.FC<RateSuggestionPopoverProps> = ({
  productId,
  columnName,
  onSelect,
  triggerClassName,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoricalEntry[]>([]);

  useEffect(() => {
    if (open && productId) {
      loadHistory();
    }
  }, [open, productId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/historical-rates?productId=${encodeURIComponent(productId)}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to load historical rates:", err);
    } finally {
      setLoading(false);
    }
  };

  const lowerCol = columnName.toLowerCase();
  const isSupply = lowerCol.includes("supply");
  const isLabour = lowerCol.includes("labour") || lowerCol.includes("install") || lowerCol.includes("labor");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`p-1 hover:text-blue-600 transition-colors focus:outline-none ${triggerClassName}`}
          title="View historical rates"
        >
          <History size={12} className="opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-2xl border-slate-200 z-[100]" align="end">
        <div className="bg-slate-50 border-b p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-md text-blue-600">
              <History size={16} />
            </div>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Rate Suggestions</h4>
              <p className="text-[9px] text-slate-500 font-medium italic">Based on previous approved projects</p>
            </div>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="animate-spin text-blue-500" size={24} />
              <p className="text-[10px] text-slate-500 font-medium">Fetching history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/50">
              <Info className="mx-auto text-slate-300 mb-2" size={20} />
              <p className="text-[10px] text-slate-400 italic">No previous data found for this product.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history
                .filter(entry => {
                  const val = isSupply ? entry.supplyRate : isLabour ? entry.labourRate : null;
                  return val !== null && val !== undefined && (typeof val === 'number' ? val > 0 : parseFloat(String(val).replace(/,/g, '')) > 0);
                })
                .map((entry, idx) => {
                  const suggestedValue = isSupply ? entry.supplyRate : isLabour ? entry.labourRate : null;
                
                  return (
                    <div
                      key={idx}
                      className="p-3 hover:bg-blue-50/50 transition-colors cursor-pointer group"
                      onClick={() => {
                        if (suggestedValue !== null && suggestedValue !== undefined) {
                          onSelect(String(suggestedValue));
                          setOpen(false);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h5 className="text-[10px] font-bold text-slate-800 truncate max-w-[180px]" title={entry.projectName}>
                          {entry.projectName}
                        </h5>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[8px] text-slate-400 font-bold uppercase">
                            {entry.date ? format(new Date(entry.date), "dd MMM yy") : "N/A"}
                          </span>
                          {entry.versionStatus && (
                            <Badge 
                              variant="outline" 
                              className={`text-[7px] h-3.5 px-1 font-bold uppercase ${
                                entry.versionStatus === 'approved' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                              }`}
                            >
                              {entry.versionStatus}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                             <span className="text-[9px] text-slate-500 font-medium">
                               Historical {isSupply ? "Supply" : "Labour"} Rate:
                             </span>
                             <span className="text-[11px] font-black text-blue-600">₹{suggestedValue}</span>
                          </div>
                          {entry.qty && (
                            <span className="text-[8px] text-slate-400 italic">Context: Qty {entry.qty}</span>
                          )}
                        </div>
                        <Badge variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-100 text-blue-700 border-blue-200 text-[8px] h-4 py-0 font-bold uppercase">
                          Use <ArrowUpRight size={8} className="ml-1" />
                        </Badge>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
        
        <div className="p-2 bg-slate-50 border-t">
          <p className="text-[8px] text-slate-400 text-center font-medium uppercase tracking-tighter">Click a rate to auto-fill the field</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
