import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, CheckCircle2, Trash2, ArrowDown, Copy, Check, AlertCircle } from 'lucide-react';
import { askCopilot } from '../../api/client';
import type { CopilotResponse, FilterParams } from '../../types/dashboard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onNavigateTab?: (tab: string) => void;
  onShowInVisualView?: (response?: CopilotResponse) => void;
  filters?: FilterParams;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  response?: CopilotResponse;
}

const CONTEXT_PROMPTS: Record<string, string[]> = {
  home: [
    "What is the total headcount and gender split?",
    "What is our YoY attrition trend?",
    "Which delivery locations have the largest headcount?",
  ],
  statewise: [
    "Break down workforce by job level & project",
    "Compare Infinite vs Prior experience by grade",
    "Show employees under selected SDM",
  ],
  techwise: [
    "Which verified technical skills are active?",
    "What are our critical skill coverage gaps?",
    "Show manager grade competency matrix",
  ],
  salarywise: [
    "What is the total workforce CTC across 54 managers?",
    "Show salary distribution by band (<5L, 5-10L, 10-15L, etc.)",
    "Who are the top earners across delivery managers?",
  ],
  salarywise2: [
    "Show annual salary trend across years",
    "Show compensation component breakdown (Base vs Bonus vs Perks)",
    "Compare promotion vs non-promotion hike percentages",
  ],
  calendar: [
    "What was the leave rate in January 2024?",
    "Which departments logged the highest leaves?",
    "Show peak leave days across delivery projects",
  ],
  employee_details: [
    "How does this employee CTC compare to grade median?",
    "What is their tenure compared to peer median?",
    "List all verified technical skills and levels",
  ],
};

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Hello! I am **ETS Genie**, your intelligent workforce assistant. Ask me any analytical questions about headcount, salaries, skills, leaves, or department trends across all 590 employees.",
};

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onNavigateTab,
  onShowInVisualView,
  filters,
}) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ets_genie_chat_history');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // Fallback to initial
      }
    }
    return [INITIAL_MESSAGE];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ets_genie_chat_history', JSON.stringify(messages));
      } catch {
        // Ignore storage quota
      }
    }
  }, [messages]);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        scrollToBottom('auto');
      }, 50);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 80;
    setShowScrollBottom(isFarFromBottom);
  };

  const handleClearChat = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('ets_genie_chat_history');
      } catch {
        // Ignore
      }
    }
    setMessages([INITIAL_MESSAGE]);
    setInput('');
  };

  const samplePrompts = CONTEXT_PROMPTS[activeTab] || CONTEXT_PROMPTS.home;

  const handleSend = async (questionText?: string) => {
    const q = questionText || input;
    if (!q.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const historyPayload = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.content,
          data: m.response?.data,
          filters: m.response?.filters,
          intent: m.response?.intent,
        }));
      const res = await askCopilot(q, activeTab, historyPayload, filters);
      const assistantMsg: Message = {
        role: 'assistant',
        content: res.answer,
        response: res,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      console.error('[Copilot Error]', e?.message || e, e?.response?.data || e);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error connecting to the analytics engine.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Dimmed backdrop on viewports < 1280px (xl) for mobile/tablet overlay mode */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 xl:hidden transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="fixed inset-y-0 right-0 z-50 xl:static xl:z-20 w-80 sm:w-[360px] xl:w-[360px] bg-white dark:bg-[#0c1829] border-l border-slate-200 dark:border-[#223755] shadow-2xl xl:shadow-none flex flex-col shrink-0 h-full transition-all duration-200">
      {/* Header */}
      <div className="h-12 px-3.5 border-b border-slate-200 dark:border-[#223755] flex items-center justify-between shrink-0 bg-slate-50/90 dark:bg-[#0f1f35]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-600 flex items-center justify-center shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-tight">ETS Genie</h3>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 uppercase">
                AI Assistant
              </span>
            </div>
            <p className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold">Context: {activeTab.replace('_', ' ').toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClearChat}
            className="px-2 py-1 rounded-md text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-[11px] font-medium cursor-pointer"
            title="Clear chat conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Close ETS Genie Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-3 flex flex-col gap-2.5 bg-slate-50/40 dark:bg-[#0a1424] scroll-smooth select-text"
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col gap-1 ${
              m.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`p-2.5 rounded-xl text-xs max-w-[92%] leading-relaxed select-text ${
                m.role === 'user'
                  ? 'bg-cyan-600 text-white font-medium rounded-br-none shadow-xs'
                  : 'bg-white dark:bg-[#12223a] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#223755] rounded-bl-none shadow-xs relative group'
              }`}
            >
              {/* Header row for Assistant with badges and Copy button */}
              {m.role === 'assistant' && (
                <div className="mb-1.5 flex items-center justify-between gap-1 text-[10px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {m.response?.intent && (
                      <span className={`px-1.5 py-0.5 rounded font-bold tracking-tight ${
                        ['GROUNDING_FAILED', 'AI_UNAVAILABLE', 'PLANNER_FAILED', 'PLANNER_REJECTED', 'TOOL_EXECUTION_FAILED', 'SYNTHESIS_FAILED', 'RAG_NO_EVIDENCE', 'RAG_FAILED'].includes(m.response.intent)
                          ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                          : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                      }`}>
                        [{m.response.intent}]
                      </span>
                    )}
                    {typeof m.response?.confidence === 'number' && (
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium font-mono">
                        {(m.response.confidence * 100).toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCopy(m.content, idx)}
                    className="p-1 rounded text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    title="Copy message to clipboard"
                  >
                    {copiedIdx === idx ? (
                      <span className="flex items-center gap-0.5 text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Check className="w-3 h-3" /> Copied!
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[9px] opacity-70 hover:opacity-100">
                        <Copy className="w-3 h-3" /> Copy
                      </span>
                    )}
                  </button>
                </div>
              )}

              <p className="whitespace-pre-wrap select-text">{m.content}</p>

              {/* Insights List */}
              {m.response?.insights && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-1 text-[11px] text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-600" /> Key Insights:
                  </span>
                  {m.response.insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{ins}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Dynamic Result Items (Cards, Charts, Tables, Notices) */}
              {m.response?.result_items && m.response.result_items.length > 0 ? (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2 w-full">
                  {m.response.result_items.map((item, idx) => {
                    if (item.presentation_mode === 'METRIC_CARD' && item.metric_card_spec) {
                      return (
                        <div key={item.requirement_id || idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">{item.metric_card_spec.label || item.title}</span>
                            <div className="text-base font-bold text-slate-900 dark:text-white">{item.metric_card_spec.value}</div>
                          </div>
                          {item.metric_card_spec.subtext && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium bg-white dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                              {item.metric_card_spec.subtext}
                            </span>
                          )}
                        </div>
                      );
                    } else if (item.presentation_mode === 'TABLE' && item.table_spec?.rows && item.table_spec.rows.length > 0) {
                      const cols = item.table_spec.columns || Object.keys(item.table_spec.rows[0] || {});
                      return (
                        <div key={item.requirement_id || idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 w-full overflow-hidden">
                          {item.title && <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{item.title}</div>}
                          <div className="overflow-x-auto max-h-56 overflow-y-auto">
                            <table className="w-full text-left text-[10px] border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700/50">
                                  {cols.map((col: string, ci: number) => (
                                    <th key={ci} className="py-1 px-1.5 font-semibold text-slate-700 dark:text-slate-200 capitalize">
                                      {col.replace(/_/g, ' ')}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {item.table_spec.rows.map((row: any, ri: number) => (
                                  <tr key={ri} className="border-b border-slate-100 dark:border-slate-700/40 hover:bg-slate-100/50 dark:hover:bg-slate-700/30">
                                    {cols.map((col: string, ci: number) => (
                                      <td key={ci} className="py-1 px-1.5 text-slate-600 dark:text-slate-300 font-mono">
                                        {typeof row[col] === 'number' ? row[col].toLocaleString() : String(row[col] ?? '')}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    } else if (item.presentation_mode === 'CHART' && item.chart_spec?.data && item.chart_spec.data.length > 0) {
                      const dataLen = item.chart_spec.data.length;
                      const isDense = dataLen > 5;
                      return (
                        <div key={item.requirement_id || idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                          {item.title && <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-1">{item.title}</div>}
                          <div className={isDense ? "h-36 w-full" : "h-28 w-full"}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={item.chart_spec.data} margin={{ top: 5, right: 5, left: -25, bottom: isDense ? 24 : 0 }}>
                                <XAxis
                                  dataKey="name"
                                  stroke="var(--muted)"
                                  tick={{ fontSize: isDense ? 8 : 9, fill: 'var(--muted)' }}
                                  interval={0}
                                  angle={isDense ? -30 : 0}
                                  textAnchor={isDense ? 'end' : 'middle'}
                                  height={isDense ? 36 : 20}
                                />
                                <YAxis stroke="var(--muted)" tick={{ fontSize: 9, fill: 'var(--muted)' }} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '6px', fontSize: '10px' }} />
                                <Bar dataKey="value" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    } else if (item.presentation_mode === 'TEXT_NOTICE' || item.error_details) {
                      const isError = item.status === 'unauthorized' || item.status === 'failed';
                      return (
                        <div
                          key={item.requirement_id || idx}
                          className={`p-2 rounded-md border text-[11px] flex items-start gap-1.5 ${
                            isError
                              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'
                              : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-300'
                          }`}
                        >
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">{item.title}: </span>
                            <span>{item.error_details}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ) : (
                m.response?.chart_data && m.response.chart_data.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={m.response.chart_data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="var(--muted)" tick={{ fontSize: 9, fill: 'var(--muted)' }} />
                        <YAxis stroke="var(--muted)" tick={{ fontSize: 9, fill: 'var(--muted)' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '6px', fontSize: '10px' }} />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              )}

              {/* Show Me Link & Source Reference */}
              {m.role === 'assistant' && (
                <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                  {(onShowInVisualView || onNavigateTab) && (
                    <button
                      onClick={() => {
                        if (onShowInVisualView) {
                          onShowInVisualView(m.response);
                        } else if (onNavigateTab) {
                          if (activeTab === 'home') onNavigateTab('statewise');
                          else if (activeTab === 'statewise') onNavigateTab('salarywise');
                          else onNavigateTab('home');
                        }
                      }}
                      className="text-cyan-700 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-200 font-bold underline cursor-pointer flex items-center gap-0.5"
                    >
                      Show in visual view &rarr;
                    </button>
                  )}
                  {m.response?.source && <span>Src: {m.response.source}</span>}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs p-2 bg-white dark:bg-[#12223a] rounded-xl w-fit border border-slate-200 dark:border-[#223755] shadow-xs">
            <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Analyzing workforce records...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll-Down Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-28 right-4 z-30 px-2.5 py-1.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-all flex items-center gap-1 text-[11px] font-medium animate-bounce cursor-pointer"
          title="Scroll down to latest response"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Scroll down</span>
        </button>
      )}

      {/* Suggested Contextual Prompts */}
      <div className="px-3 py-1.5 border-t border-slate-200 dark:border-[#223755] bg-white dark:bg-[#0c1829] flex flex-col gap-1 shrink-0">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Contextual Questions</span>
        <div className="flex flex-wrap gap-1">
          {samplePrompts.slice(0, 3).map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              className="text-[10px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#12223a] border border-slate-200 dark:border-[#223755] hover:text-cyan-700 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-[#162a45] hover:border-cyan-200 dark:hover:border-cyan-700 rounded-full px-2 py-0.5 transition-colors truncate max-w-full font-medium text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-2 border-t border-slate-200 dark:border-[#223755] bg-white dark:bg-[#0c1829] flex items-center gap-1.5 shrink-0"
      >
        <input
          type="text"
          placeholder={`Ask AI about ${activeTab}...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-slate-50 dark:bg-[#12223a] border border-slate-200 dark:border-[#223755] text-slate-900 dark:text-slate-100 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-purple-600 focus:bg-white dark:focus:bg-[#162a45] placeholder-slate-400 dark:placeholder-slate-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors shadow-xs"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Audit Footprint Footer */}
      <div className="px-3 py-1 bg-slate-100 dark:bg-[#0a1526] border-t border-slate-200 dark:border-[#223755] text-[9px] text-slate-500 dark:text-slate-400 font-mono flex items-center justify-between shrink-0">
        <span>ETS Engine · 590 records</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">● Verified</span>
      </div>
    </aside>
    </>
  );
};
