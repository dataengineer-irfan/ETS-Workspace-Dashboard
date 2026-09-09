import React, { useState } from 'react';
import { Bot, Send, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { askCopilot } from '../../api/client';
import type { CopilotResponse } from '../../types/dashboard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onNavigateTab?: (tab: string) => void;
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
    "Explain the salary trend dip in 2024",
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

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onNavigateTab,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I am your **ETS AI Workforce Copilot**. Ask me any analytical questions about headcount, salaries, skills, leaves, or department trends across all 590 employees.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const samplePrompts = CONTEXT_PROMPTS[activeTab] || CONTEXT_PROMPTS.home;

  const handleSend = async (questionText?: string) => {
    const q = questionText || input;
    if (!q.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await askCopilot(q, activeTab);
      const assistantMsg: Message = {
        role: 'assistant',
        content: res.answer,
        response: res,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
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
    <aside className="w-80 md:w-96 bg-white dark:bg-[#0c1829] border-l border-slate-200 dark:border-[#223755] shadow-xl flex flex-col shrink-0 h-full select-none z-20">
      {/* Header */}
      <div className="h-12 px-3.5 border-b border-slate-200 dark:border-[#223755] flex items-center justify-between shrink-0 bg-slate-50/90 dark:bg-[#0f1f35]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-600 flex items-center justify-center shadow-xs">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-tight">ETS AI Copilot</h3>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 uppercase">
                Docked
              </span>
            </div>
            <p className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold">Context: {activeTab.replace('_', ' ').toUpperCase()}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Close Copilot Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2.5 bg-slate-50/40 dark:bg-[#0a1424]">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col gap-1 ${
              m.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`p-2.5 rounded-xl text-xs max-w-[92%] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-cyan-600 text-white font-medium rounded-br-none shadow-xs'
                  : 'bg-white dark:bg-[#12223a] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#223755] rounded-bl-none shadow-xs'
              }`}
            >
              {/* Intent Badge for Assistant */}
              {m.role === 'assistant' && m.response?.intent && (
                <div className="mb-1.5 flex items-center justify-between gap-1 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold tracking-tight">
                    [{m.response.intent}]
                  </span>
                  {m.response.confidence && (
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium font-mono">
                      {(m.response.confidence * 100).toFixed(0)}% confidence
                    </span>
                  )}
                </div>
              )}

              <p className="whitespace-pre-wrap">{m.content}</p>

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

              {/* Chart Data in Copilot */}
              {m.response?.chart_data && m.response.chart_data.length > 0 && (
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
              )}

              {/* Show Me Link & Source Reference */}
              {m.role === 'assistant' && (
                <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        if (activeTab === 'home') onNavigateTab('statewise');
                        else if (activeTab === 'statewise') onNavigateTab('salarywise');
                        else onNavigateTab('home');
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
      </div>

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
  );
};
