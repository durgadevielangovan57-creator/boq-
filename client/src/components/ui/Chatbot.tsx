import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Loader2 } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import apiFetch from "@/lib/api";

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'bot', text: string}[]>([
    { role: 'bot', text: "Hi! I'm your database assistant. Ask me about material prices, availability, or products.\n\nTry:\n- 'price of MDF'\n- 'do we have hettich hinges'\n- 'list restroom products'" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    { label: "❓ Help", query: "help" },
    { label: "🏗️ Projects", query: "how many projects" },
    { label: "📂 Categories", query: "list categories" },
    { label: "💰 Price of MDF", query: "price of MDF" }
  ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isTyping]);

  const handleSubmit = async (e: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const queryToUse = overrideQuery || input;
    if (!queryToUse.trim() || isLoading) return;

    const userMsg = queryToUse.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);
    setIsTyping(true);

    try {
      const res = await apiFetch("/api/bot-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg })
      });
      
      const data = await res.json();
      // Artificial delay for better UX
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'bot', text: data.answer || "Sorry, I had an error." }]);
        setIsTyping(false);
      }, 600);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I'm having trouble connecting to the database right now." }]);
      setIsTyping(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg ${isOpen ? 'scale-0' : 'scale-100'} transition-transform duration-200 z-50`}
      >
        <MessageCircle size={28} />
      </Button>

      <div className={`fixed bottom-6 right-6 w-[380px] h-[550px] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 z-50 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-primary text-primary-foreground rounded-t-2xl shadow-md">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-1.5 rounded-lg">
              <Bot size={20} />
            </div>
            <div>
              <div className="font-semibold tracking-wide text-sm leading-tight">Assistant Bot</div>
              <div className="text-[10px] text-primary-foreground/70 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> AI System Online
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white hover:bg-white/20" onClick={() => setIsOpen(false)}>
            <X size={18} />
          </Button>
        </div>

        {/* Messages body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                m.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                  : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
              }`}>
                <div className="whitespace-pre-wrap leading-relaxed markdown-lite">
                   {m.text}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggestions chips */}
        <div className="px-4 py-2 flex flex-wrap gap-2 bg-slate-50 border-t border-slate-100">
           {suggestions.map((s, i) => (
             <button
               key={i}
               onClick={() => handleSubmit(null as any, s.query)}
               className="text-[11px] bg-white border border-slate-200 hover:border-primary hover:text-primary px-2.5 py-1 rounded-full transition-all shadow-subtle active:scale-95"
             >
               {s.label}
             </button>
           ))}
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="p-3 bg-white rounded-b-2xl flex gap-2 border-t border-slate-100">
          <Input 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message or click a suggestion..."
            className="flex-1 text-sm bg-slate-50/50 border-slate-200 focus:bg-white transition-all h-10 px-4 rounded-xl"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="shrink-0 h-10 w-10 rounded-xl shadow-md transition-all active:scale-95">
            <Send size={18} />
          </Button>
        </form>
      </div>
    </>
  );
}
