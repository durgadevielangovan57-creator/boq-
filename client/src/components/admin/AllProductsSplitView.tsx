import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Package, X, ChevronRight, Loader2, Tag, Box, Layers, BarChart2, AlertTriangle, CheckCircle, Clock, Maximize2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import apiFetch from '@/lib/api';
import { fuzzySearch } from '@/lib/utils';

type Product = { id: string; name: string; subcategory: string; created_at: string; image?: string; is_approved?: boolean; has_price_updates?: boolean; };
type ConfigItem = { material_id: string; material_name: string; unit: string; qty: number; base_qty: number; wastage_pct?: number; rate: number; supply_rate?: number; install_rate?: number; location?: string; amount: number; shop_name?: string; };
type Config = { config_name?: string; required_unit_type?: string; base_required_qty?: number; wastage_pct_default?: number; description?: string; total_cost?: number; dim_a?: number; dim_b?: number; dim_c?: number; };
type ProductDetail = { config: Config; items: ConfigItem[]; };
interface AllProductsSplitViewProps { products: Product[]; approvals?: any[]; onClose: () => void; }

const fmt = (n: number | string | undefined) => n !== undefined && n !== null ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const fmtNum = (n: number | string | undefined, decimals = 3) => n !== undefined && n !== null ? Number(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—';
const parseImages = (img?: string): string[] => { if (!img) return []; try { return img.startsWith('[') ? JSON.parse(img) : [img]; } catch { return [img]; } };

export function AllProductsSplitView({ products, approvals = [], onClose }: AllProductsSplitViewProps) {
    const [search, setSearch] = useState('');
    const [subcategoryFilter, setSubcategoryFilter] = useState('__ALL__');
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [detail, setDetail] = useState<ProductDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 50;

    const subcategories = useMemo(() => { const s = new Set<string>(); products.forEach(p => { if (p.subcategory) s.add(p.subcategory); }); return Array.from(s).sort(); }, [products]);
    const approvalMap = useMemo(() => { const m: Record<string, string> = {}; (approvals || []).forEach((a: any) => { if (!m[a.product_id]) m[a.product_id] = a.status; }); return m; }, [approvals]);
    const filtered = useMemo(() => { let list = products; if (search) list = list.filter(p => fuzzySearch(search, p.name || '')); if (subcategoryFilter !== '__ALL__') { list = list.filter(p => subcategoryFilter === '__NONE__' ? !p.subcategory : p.subcategory === subcategoryFilter); } return list; }, [products, search, subcategoryFilter]);
    const paginated = useMemo(() => filtered.slice(0, PAGE_SIZE * (page + 1)), [filtered, page]);
    const hasMore = filtered.length > PAGE_SIZE * (page + 1);
    const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId) || null, [products, selectedProductId]);

    const loadDetail = useCallback(async (productId: string) => {
        setLoadingDetail(true); setDetail(null);
        try {
            const res = await apiFetch(`/api/step11-products/${productId}`);
            if (res.ok) { const d = await res.json(); const configs = d.configurations || []; if (configs.length > 0) { const latest = configs[0]; setDetail({ config: latest.product || {}, items: latest.items || [] }); } else { setDetail({ config: {}, items: [] }); } }
        } catch { setDetail({ config: {}, items: [] }); }
        finally { setLoadingDetail(false); }
    }, []);

    useEffect(() => { if (selectedProductId) loadDetail(selectedProductId); }, [selectedProductId, loadDetail]);
    useEffect(() => { setPage(0); }, [search, subcategoryFilter]);

    const approvalStatus = selectedProduct ? approvalMap[selectedProduct.id] : undefined;
    const grandTotal = useMemo(() => { if (!detail?.items?.length) return 0; return detail.items.reduce((s, i) => s + Number(i.amount || 0), 0); }, [detail]);
    const totalWithWastage = useMemo(() => { if (!detail?.items?.length || !detail.config) return 0; const wastagePct = Number(detail.config.wastage_pct_default || 0); return grandTotal * (1 + wastagePct / 100); }, [detail, grandTotal]);

    return (
        <div className={`flex flex-col md:flex-row overflow-hidden bg-background transition-all duration-300 ${isFullScreen ? 'fixed inset-2 z-50 shadow-2xl rounded-xl border' : 'h-[82vh] border rounded-xl shadow-sm'}`}>
            <div className={`flex flex-col bg-slate-50/60 border-r transition-all duration-300 shrink-0 ${selectedProduct ? 'hidden md:flex md:w-[340px]' : 'w-full'}`}>
                <div className="p-4 border-b bg-white space-y-3 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" /><span className="font-bold text-sm text-slate-800 uppercase tracking-wider">Products ({filtered.length})</span></div>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setIsFullScreen(v => !v)} className="h-7 w-7 text-slate-400 hover:text-slate-700"><Maximize2 className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-slate-400 hover:text-slate-700"><X className="h-3.5 w-3.5" /></Button>
                        </div>
                    </div>
                    <div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="pl-8 h-8 text-sm bg-slate-50 border-slate-200" /></div>
                    <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
                        <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200"><SelectValue placeholder="All Subcategories" /></SelectTrigger>
                        <SelectContent className="max-h-72 overflow-y-auto">
                            <SelectItem value="__ALL__">All Subcategories</SelectItem>
                            <SelectItem value="__NONE__" className="text-slate-400 italic">Uncategorized</SelectItem>
                            {subcategories.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <ScrollArea className="flex-1">
                    <div className="divide-y divide-slate-100">
                        {paginated.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Package className="h-9 w-9 mb-2 opacity-30" /><p className="text-sm">No products found</p></div>
                        ) : paginated.map(product => {
                            const status = approvalMap[product.id];
                            const isSelected = selectedProductId === product.id;
                            return (
                                <div key={product.id} onClick={() => setSelectedProductId(product.id)} className={`flex items-center gap-3 p-3 cursor-pointer transition-all border-l-[3px] ${isSelected ? 'bg-blue-50 border-blue-500' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'}`}>
                                    <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                                        {parseImages(product.image)[0] ? <img src={parseImages(product.image)[0]} alt="" className="w-full h-full object-contain" /> : <Package className="h-4 w-4 text-slate-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{product.name}</p>
                                            {status === 'approved' && <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />}
                                            {status === 'pending' && <Clock className="h-3 w-3 text-amber-500 shrink-0" />}
                                            {product.has_price_updates && <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />}
                                        </div>
                                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{product.subcategory || 'No subcategory'}</p>
                                    </div>
                                    {isSelected && <ChevronRight className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                                </div>
                            );
                        })}
                        {hasMore && (
                            <div className="p-3 flex justify-center">
                                <Button variant="ghost" size="sm" className="text-xs text-slate-500" onClick={() => setPage(p => p + 1)}>Load more ({filtered.length - paginated.length} remaining)</Button>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
                {!selectedProduct ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3"><Layers className="h-12 w-12 opacity-20" /><p className="font-medium text-sm">Select a product to view details</p><p className="text-xs opacity-70">Click any product from the list</p></div>
                ) : (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="shrink-0 px-5 pt-4 pb-3 border-b bg-white flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="h-12 w-12 shrink-0 rounded-xl bg-slate-100 border flex items-center justify-center overflow-hidden">
                                    {parseImages(selectedProduct.image)[0] ? <img src={parseImages(selectedProduct.image)[0]} alt="" className="w-full h-full object-contain" /> : <Package className="h-6 w-6 text-slate-400" />}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-bold text-slate-900 leading-tight truncate">{selectedProduct.name}</h2>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        {selectedProduct.subcategory && <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-medium bg-slate-50 border-slate-200 text-slate-600">{selectedProduct.subcategory}</Badge>}
                                        {approvalStatus === 'approved' && <Badge className="text-[10px] h-4 px-1.5 bg-green-100 text-green-700 border-green-200 border">Approved</Badge>}
                                        {approvalStatus === 'pending' && <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 border-amber-200 border">Pending</Badge>}
                                        {selectedProduct.is_approved && <Badge className="text-[10px] h-4 px-1.5 bg-blue-100 text-blue-700 border-blue-200 border">Active</Badge>}
                                    </div>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="md:hidden shrink-0" onClick={() => setSelectedProductId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                        <ScrollArea className="flex-1">
                            {loadingDetail ? (
                                <div className="flex items-center justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
                            ) : detail ? (
                                <div className="p-5 space-y-5">
                                    {detail.config && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {[
                                                { label: 'Unit Type', value: detail.config.required_unit_type || '—', icon: Tag },
                                                { label: 'Base Qty', value: fmtNum(detail.config.base_required_qty, 2), icon: Box },
                                                { label: 'Wastage %', value: detail.config.wastage_pct_default != null ? `${detail.config.wastage_pct_default}%` : '—', icon: BarChart2 },
                                                { label: 'Grand Total', value: fmt(detail.config.total_cost), icon: BarChart2, highlight: true },
                                            ].map(card => (
                                                <div key={card.label} className={`rounded-lg p-3 border ${card.highlight ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{card.label}</p>
                                                    <p className={`text-sm font-bold ${card.highlight ? 'text-green-700' : 'text-slate-800'}`}>{card.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {(detail.config.dim_a || detail.config.dim_b || detail.config.dim_c) && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Dimensions</p>
                                            <div className="flex gap-3">
                                                {[['L', detail.config.dim_a], ['W', detail.config.dim_b], ['H', detail.config.dim_c]].filter(([, v]) => v).map(([label, val]) => (
                                                    <div key={label as string} className="flex-1 bg-slate-50 rounded-lg border border-slate-200 p-2.5 text-center"><p className="text-[10px] text-slate-400 font-bold uppercase">{label as string}</p><p className="text-sm font-bold text-slate-800">{val as string}</p></div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {detail.config.description && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Description</p>
                                            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg border border-slate-200 p-3">{detail.config.description}</p>
                                        </div>
                                    )}
                                    <Separator />
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Material Specifications ({detail.items.length} items)</p>
                                        {detail.items.length === 0 ? (
                                            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-slate-200"><Package className="h-7 w-7 mx-auto mb-2 opacity-30" /><p className="text-xs">No materials configured yet</p></div>
                                        ) : (
                                            <div className="rounded-lg border border-slate-200 overflow-hidden">
                                                <div className="grid bg-slate-100 border-b border-slate-200 sticky top-0 z-10" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                                                    {['Material', 'Vendor/Shop', 'Unit', 'Base Qty', 'Wastage Qty', 'Total Qty', 'Rate / Amount'].map(h => (<div key={h} className="px-2.5 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500">{h}</div>))}
                                                </div>
                                                <div className="divide-y divide-slate-100">
                                                    {detail.items.map((item, idx) => {
                                                        const baseQty = Number(item.base_qty || item.qty || 0);
                                                        const wastagePct = Number(item.wastage_pct ?? detail.config.wastage_pct_default ?? 0);
                                                        const wastageQty = baseQty * wastagePct / 100;
                                                        const totalQty = baseQty + wastageQty;
                                                        const rate = Number(item.rate || 0);
                                                        const amount = Number(item.amount || 0);
                                                        return (
                                                            <div key={idx} className="grid hover:bg-blue-50/30 transition-colors" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                                                                <div className="px-2.5 py-2.5"><p className="text-xs font-semibold text-slate-800 leading-tight">{item.material_name}</p>{item.location && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{item.location}</p>}</div>
                                                                <div className="px-2.5 py-2.5 flex items-center"><span className="text-[11px] text-slate-500 truncate">{item.shop_name || '—'}</span></div>
                                                                <div className="px-2.5 py-2.5 flex items-center"><span className="text-[11px] font-medium text-slate-600">{item.unit || '—'}</span></div>
                                                                <div className="px-2.5 py-2.5 flex items-center"><span className="text-[11px] font-mono text-slate-700">{fmtNum(baseQty)}</span></div>
                                                                <div className="px-2.5 py-2.5 flex items-center"><span className={`text-[11px] font-mono ${wastageQty > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{wastageQty > 0 ? `+${fmtNum(wastageQty)}` : '—'}</span></div>
                                                                <div className="px-2.5 py-2.5 flex items-center"><span className="text-[11px] font-mono font-bold text-slate-800">{fmtNum(totalQty)}</span></div>
                                                                <div className="px-2.5 py-2.5"><p className="text-[11px] font-bold text-slate-700">{fmt(amount)}</p><p className="text-[10px] text-slate-400 font-mono">@ {fmt(rate)}</p></div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="grid bg-slate-50 border-t-2 border-slate-300" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                                                    <div className="px-2.5 py-2.5 col-span-6"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Grand Total</p></div>
                                                    <div className="px-2.5 py-2.5"><p className="text-sm font-black text-green-700">{fmt(grandTotal)}</p>{totalWithWastage > grandTotal && <p className="text-[10px] text-amber-600 font-semibold">+Wastage: {fmt(totalWithWastage)}</p>}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {detail.config.config_name && (
                                        <div className="flex items-center gap-2 pt-1"><p className="text-[10px] text-slate-400">Config:</p><Badge variant="outline" className="text-[10px] h-4 font-medium text-slate-500">{detail.config.config_name}</Badge></div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Package className="h-9 w-9 mb-2 opacity-30" /><p className="text-sm">No configuration found</p></div>
                            )}
                        </ScrollArea>
                    </div>
                )}
            </div>
        </div>
    );
}