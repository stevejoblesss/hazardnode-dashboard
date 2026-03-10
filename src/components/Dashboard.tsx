"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  Activity, 
  AlertTriangle, 
  Droplets, 
  Thermometer, 
  Compass, 
  Wind, 
  ShieldCheck,
  History
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface NodeReport {
  id: number;
  timestamp: number;
  node_id: number;
  temp: number;
  hum: number;
  pitch: number;
  roll: number;
  smoke_analog: number;
  smoke_digital: boolean;
  danger: boolean;
  inserted_at: string;
}

export default function Dashboard() {
  const [reports, setReports] = useState<NodeReport[]>([]);
  const [nodes, setNodes] = useState<Record<number, NodeReport>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    async function fetchInitialData() {
      const { data, error } = await supabase
        .from("node_reports")
        .select("*")
        .order("inserted_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching reports:", error);
      } else {
        setReports(data || []);
        
        // Update current node status map
        const latestNodes: Record<number, NodeReport> = {};
        data?.forEach((report) => {
          if (!latestNodes[report.node_id]) {
            latestNodes[report.node_id] = report;
          }
        });
        setNodes(latestNodes);
      }
      setLoading(false);
    }

    fetchInitialData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("node_reports_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "node_reports" },
        (payload) => {
          const newReport = payload.new as NodeReport;
          setReports((prev) => [newReport, ...prev].slice(0, 100));
          setNodes((prev) => ({
            ...prev,
            [newReport.node_id]: newReport
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeNodes = Object.values(nodes);
  const dangerNodes = activeNodes.filter(n => n.danger);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <Activity className="h-12 w-12 animate-pulse text-red-500" />
          <p className="text-xl font-medium">Initializing HazardNode...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 text-zinc-100 md:p-8">
      {/* Header */}
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-zinc-800 pb-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter text-white">
            HAZARD<span className="text-red-600">NODE</span>
          </h1>
          <p className="mt-1 text-zinc-400">Real-time sensor network monitoring</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={cn(
            "flex items-center gap-2 rounded-full px-4 py-1 text-sm font-semibold",
            dangerNodes.length > 0 ? "bg-red-500/20 text-red-500 animate-pulse" : "bg-green-500/20 text-green-500"
          )}>
            {dangerNodes.length > 0 ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {dangerNodes.length > 0 ? `${dangerNodes.length} NODES IN DANGER` : "SYSTEM SECURE"}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-1 text-sm text-zinc-400">
            <Activity className="h-4 w-4 text-zinc-500" />
            {activeNodes.length} ACTIVE NODES
          </div>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Active Nodes Column */}
        <div className="space-y-6 lg:col-span-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <Activity className="h-5 w-5 text-red-500" /> Node Status
          </h2>
          <div className="space-y-4">
            {activeNodes.map((node) => (
              <div 
                key={node.node_id} 
                className={cn(
                  "relative overflow-hidden rounded-xl border p-4 transition-all hover:scale-[1.02]",
                  node.danger ? "border-red-500 bg-red-950/20" : "border-zinc-800 bg-zinc-900/50"
                )}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Node #{node.node_id}</h3>
                    <p className="text-xs text-zinc-500">
                      Last seen: {format(new Date(node.inserted_at), "HH:mm:ss")}
                    </p>
                  </div>
                  {node.danger && (
                    <div className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white uppercase tracking-wider animate-pulse">
                      DANGER
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-zinc-800 p-2 text-zinc-400">
                      <Thermometer className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Temp</p>
                      <p className="font-semibold text-white">{node.temp}°C</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-zinc-800 p-2 text-zinc-400">
                      <Droplets className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Hum</p>
                      <p className="font-semibold text-white">{node.hum}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-zinc-800 p-2 text-zinc-400">
                      <Compass className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Pitch/Roll</p>
                      <p className="font-semibold text-white text-xs">{Math.round(node.pitch)}° / {Math.round(node.roll)}°</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-zinc-800 p-2 text-zinc-400">
                      <Wind className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Smoke</p>
                      <p className={cn("font-semibold", node.smoke_digital ? "text-red-400" : "text-white")}>
                        {node.smoke_digital ? "DETECTED" : "CLEAR"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {activeNodes.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">
                Waiting for node data...
              </div>
            )}
          </div>
        </div>

        {/* Charts Column */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-white">
              <Thermometer className="h-5 w-5 text-orange-500" /> Temperature Trend
            </h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[...reports].reverse()}>
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis 
                    dataKey="inserted_at" 
                    tickFormatter={(time) => format(new Date(time), "HH:mm")}
                    stroke="#52525b"
                    fontSize={12}
                  />
                  <YAxis stroke="#52525b" fontSize={12} unit="°C" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", color: "#fff" }}
                    labelFormatter={(label) => format(new Date(label), "HH:mm:ss")}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="temp" 
                    stroke="#f97316" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorTemp)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-white">
              <History className="h-5 w-5 text-blue-500" /> Recent Activity Log
            </h2>
            <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-2">
                {reports.slice(0, 20).map((report) => (
                  <div key={report.id} className="flex items-center justify-between border-b border-zinc-800/50 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        report.danger ? "bg-red-500 animate-pulse" : "bg-green-500"
                      )} />
                      <span className="font-mono text-zinc-500">
                        [{format(new Date(report.inserted_at), "HH:mm:ss")}]
                      </span>
                      <span className="text-zinc-300">Node #{report.node_id}</span>
                    </div>
                    <div className="text-zinc-500">
                      T: {report.temp}°C | H: {report.hum}% | S: {report.smoke_digital ? "⚠️" : "OK"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #18181b;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
      `}</style>
    </div>
  );
}
