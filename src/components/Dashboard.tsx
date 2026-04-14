"use client";

import { useEffect, useState, useCallback } from "react";
import { rtdb } from "@/lib/firebaseClient";
import { ref, onValue, query, limitToLast, orderByKey } from "firebase/database";
import { 
  Activity, 
  AlertTriangle, 
  Droplets, 
  Thermometer, 
  Compass, 
  Wind, 
  ShieldCheck,
  History,
  LayoutGrid,
  Zap,
  Wifi,
  WifiOff,
  Clock,
  Server,
  Terminal
} from "lucide-react";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface NodeReport {
  id: string;
  timestamp: number;
  node_id: string | number;
  type?: "sensor" | "receiver" | "sender";
  temp: number;
  hum: number;
  pitch: number;
  roll: number;
  smoke_analog: number;
  smoke_digital: boolean;
  danger: boolean;
  rssi?: number;
  edge_ai_class?: number;
  inserted_at: string;
}

interface LogEntry {
  id: string;
  message: string;
  timestamp: string;
  type: "info" | "error" | "success" | "warn";
  node_id: string | number;
}

const getRssiDisplay = (rssi?: number, isOnline?: boolean) => {
  if (!isOnline || rssi === undefined) return { icon: WifiOff, color: "text-zinc-500", label: "OFFLINE" };
  if (rssi >= -50) return { icon: Wifi, color: "text-emerald-500", label: "Excellent" };
  if (rssi >= -70) return { icon: Wifi, color: "text-blue-500", label: "Good" };
  if (rssi >= -85) return { icon: Wifi, color: "text-amber-500", label: "Fair" };
  return { icon: Wifi, color: "text-red-500", label: "Weak" };
};

interface NodeCardProps {
  node: NodeReport;
  isOnline: boolean;
}

const NodeCard = ({ 
  node, 
  isOnline
}: NodeCardProps) => {
  const rssiDisplay = getRssiDisplay(node.rssi, isOnline);
  const lastSeen = formatDistanceToNow(new Date(node.inserted_at), { addSuffix: true });
  const isReceiver = node.type === "receiver";

  // Edge AI classification logic (0=Normal, 1=Warning, 2=Hazard)
  const getEdgeAiLabel = (cls?: number) => {
    switch(cls) {
      case 1: return { label: "WARNING", color: "text-amber-400", bg: "bg-amber-500/5" };
      case 2: return { label: "HAZARD", color: "text-red-400", bg: "bg-red-500/5" };
      default: return { label: "NORMAL", color: "text-emerald-400", bg: "bg-emerald-500/5" };
    }
  };

  const edgeAi = getEdgeAiLabel(node.edge_ai_class);

  return (
    <div 
      className={cn(
        "group relative rounded-lg border p-5 transition-all duration-300 shadow-subtle hover:translate-y-[-2px]",
        !isReceiver && (node.danger || node.edge_ai_class === 2)
          ? "border-red-500/50 bg-red-500/5 hover:bg-red-500/10" 
          : !isReceiver && node.edge_ai_class === 1
            ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
            : !isOnline 
              ? "border-zinc-900 bg-zinc-900/10 opacity-60 grayscale-[0.5]"
              : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-zinc-700"
      )}
    >
      <div className={cn("flex items-start justify-between", !isReceiver ? "mb-6" : "")}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-800",
            !isReceiver && (node.danger || node.edge_ai_class === 2) ? "border-red-500/30" : isOnline ? "border-zinc-800" : "border-zinc-900"
          )}>
            {isReceiver ? (
              <Server className={cn("h-5 w-5", isOnline ? "text-amber-500" : "text-zinc-600")} />
            ) : (
              <Activity className={cn("h-5 w-5", (node.danger || node.edge_ai_class === 2) ? "text-red-500" : isOnline ? "text-blue-500" : "text-zinc-600")} />
            )}
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
              {isReceiver ? "System Gateway" : "Device Unit"}
            </span>
            <h3 className="text-xl font-bold text-white leading-tight">
              {isReceiver 
                ? `Gateway ${String(node.node_id).replace(/[^0-9]/g, '') || node.node_id}`
                : (typeof node.node_id === 'number' ? `Node ${String(node.node_id).padStart(2, '0')}` : node.node_id)
              }
            </h3>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 mb-1">
              <rssiDisplay.icon className={cn("h-3.5 w-3.5", rssiDisplay.color)} />
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", rssiDisplay.color)}>
                {isOnline && node.rssi ? `${node.rssi} dBm` : rssiDisplay.label}
              </span>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Clock className="h-3 w-3 text-zinc-500" />
              <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">
                {lastSeen}
              </span>
            </div>
          </div>
        </div>
      </div>

      {!isReceiver ? (
        <>
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Thermometer className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Temperature</span>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-white">{node.temp}<span className="text-sm text-zinc-500 ml-0.5">°C</span></p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Droplets className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Humidity</span>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-white">{node.hum}<span className="text-sm text-zinc-500 ml-0.5">%</span></p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Wifi className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Signal Strength</span>
              </div>
              <p className={cn(
                "text-sm font-medium font-mono",
                rssiDisplay.color
              )}>
                {isOnline && node.rssi ? `${node.rssi} dBm` : "---"} <span className="text-[10px] opacity-70 ml-1">({rssiDisplay.label})</span>
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Compass className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Orientation</span>
              </div>
              <p className="text-sm font-medium text-white font-mono">
                P: {node.pitch.toFixed(1)}° <span className="text-zinc-600 mx-1">/</span> R: {node.roll.toFixed(1)}°
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Wind className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Smoke Analysis</span>
              </div>
              <p className={cn(
                "text-xs font-bold uppercase tracking-widest",
                node.smoke_digital ? "text-red-400" : "text-emerald-400"
              )}>
                {node.smoke_digital ? "CRITICAL ALERT" : "ATMOSPHERE CLEAR"}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/50">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">Edge AI Inference</span>
            </div>
            
            <div className={cn("flex items-center justify-between border border-white/5 rounded-md p-2", edgeAi.bg)}>
              <div>
                <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider block mb-0.5">Classification</span>
                <span className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  edgeAi.color
                )}>
                  {edgeAi.label}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider block mb-0.5">Source</span>
                <span className="text-[10px] font-mono font-bold text-blue-400/80 uppercase">
                  ON-DEVICE
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-1000",
                node.smoke_analog > 2000 || node.edge_ai_class === 2 ? "bg-red-500" : node.edge_ai_class === 1 ? "bg-amber-500" : "bg-blue-500"
              )}
              style={{ width: `${Math.min(100, (node.smoke_analog / 4095) * 100)}%` }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
};

export default function Dashboard() {
  const [reports, setReports] = useState<NodeReport[]>([]);
  const [nodes, setNodes] = useState<Record<string, NodeReport>>({});
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "error" | "reconnecting">("connecting");
  const [now, setNow] = useState(new Date());
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Periodically update the "now" time to keep "Last Seen" and "Online" counts accurate
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 2000); // Update every 2s for 10s threshold
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Firebase handles connection state automatically. We'll listen to the special .info/connected path.
    const connectedRef = ref(rtdb, ".info/connected");
    const unsubscribeConn = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        setConnectionStatus("connected");
      } else {
        // Only show reconnecting if we were already loading or connected
        setConnectionStatus(prev => prev === "connected" ? "reconnecting" : "connecting");
      }
    });

    // 1. Listen for latest node states
    const nodesRef = ref(rtdb, "nodes");
    const unsubscribeNodes = onValue(nodesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const latestNodes: Record<string, NodeReport> = {};
        
        Object.keys(data).forEach(id => {
          if (data[id].latest) {
            latestNodes[id] = { ...data[id].latest, id };
          }
        });
        
        setNodes(latestNodes);
        setLoading(false);
      } else {
        setLoading(false);
      }
    }, (error) => {
      console.error("Firebase nodes subscription error:", error);
      setConnectionStatus("error");
    });

    // 2. Listen for historical reports (last 100)
    const reportsRef = query(ref(rtdb, "node_reports"), orderByKey(), limitToLast(100));
    const unsubscribeReports = onValue(reportsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const reportsList = Object.keys(data)
          .map(key => ({ ...data[key], id: key }))
          .reverse(); // Newest first
        
        setReports(reportsList);
      }
    });

    // 3. Listen for system logs (Serial Monitor)
    const logsRef = query(ref(rtdb, "system_logs"), orderByKey(), limitToLast(50));
    const unsubscribeLogs = onValue(logsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const logsList = Object.keys(data)
          .map(key => ({ ...data[key], id: key }))
          .reverse();
        setLogs(logsList);
      }
    });

    return () => {
      unsubscribeConn();
      unsubscribeNodes();
      unsubscribeReports();
      unsubscribeLogs();
    };
  }, []); // Removed fetchAiPrediction dependency

  // Periodically fetch AI predictions for active nodes as a fallback
  /*
  useEffect(() => {
    const interval = setInterval(() => {
      const nodeIds = Object.keys(nodes);
      if (nodeIds.length > 0) {
        nodeIds.forEach(nodeId => fetchAiPrediction(nodeId));
      }
    }, 15000); 
    
    return () => clearInterval(interval);
  }, [nodes, fetchAiPrediction]);
  */

  const activeNodes = Object.values(nodes).sort((a, b) => String(a.node_id).localeCompare(String(b.node_id)));
  const sensorNodes = activeNodes.filter(n => !n.type || n.type === "sensor" || n.type === "sender");
  const receiverNodes = activeNodes.filter(n => n.type === "receiver");
  
  // A node is considered "online" if it has sent a report in the last 15 seconds (10s delay + 5s buffer)
  const STALE_THRESHOLD = 15 * 1000; 
  const onlineNodes = activeNodes.filter(n => {
    const lastSeenTime = new Date(n.inserted_at).getTime();
    return (now.getTime() - lastSeenTime) < STALE_THRESHOLD;
  });

  const dangerNodes = onlineNodes.filter(n => n.danger);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-[#f4f4f5]">
        <div className="flex flex-col items-center gap-4">
          <Zap className="h-8 w-8 animate-pulse text-blue-500" />
          <p className="text-sm font-medium tracking-tight">Initializing HazardNode Systems (Firebase)...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6 text-[#f4f4f5] md:p-10">
      <header className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid className="h-4 w-4 text-blue-500" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">Mission Control</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            HazardNode <span className="text-zinc-500 font-medium">Dashboard</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold shadow-subtle border transition-colors duration-500",
            dangerNodes.length > 0 
              ? "bg-red-500/10 border-red-500/50 text-red-500 animate-pulse" 
              : "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
          )}>
            {dangerNodes.length > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {dangerNodes.length > 0 ? `${dangerNodes.length} ALERTS ACTIVE` : "SYSTEM NOMINAL"}
          </div>
          <div className="flex items-center gap-2 rounded-md bg-zinc-900/50 border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 shadow-subtle">
            <Activity className={cn(
              "h-3.5 w-3.5",
              connectionStatus === "connected" ? "text-blue-500" : connectionStatus === "error" ? "text-red-500" : "text-zinc-500 animate-pulse"
            )} />
            {connectionStatus === "connected" ? `${onlineNodes.length} NODES ONLINE` : connectionStatus === "error" ? "CONNECTION ERROR" : "CONNECTING..."}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-12">
          {/* Sensor Nodes Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" /> Active Device Units
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sensorNodes.length > 0 ? (
                sensorNodes.map((node) => (
                  <NodeCard 
                    key={node.node_id} 
                    node={node} 
                    isOnline={(now.getTime() - new Date(node.inserted_at).getTime()) < STALE_THRESHOLD}
                  />
                ))
              ) : (
                <div className="col-span-full py-10 flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/10">
                  <Activity className="h-6 w-6 text-zinc-700 mb-2 animate-pulse" />
                  <p className="text-xs text-zinc-600 uppercase tracking-widest font-bold">No sensors detected</p>
                </div>
              )}
            </div>
          </div>

          {/* Receiver Nodes Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Server className="h-4 w-4 text-amber-500" /> Receiver Hubs
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {receiverNodes.length > 0 ? (
                receiverNodes.map((node) => (
                  <NodeCard 
                    key={node.node_id} 
                    node={node} 
                    isOnline={(now.getTime() - new Date(node.inserted_at).getTime()) < STALE_THRESHOLD}
                  />
                ))
              ) : (
                <div className="col-span-full py-10 flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/10">
                  <Server className="h-6 w-6 text-zinc-700 mb-2 animate-pulse" />
                  <p className="text-xs text-zinc-600 uppercase tracking-widest font-bold">No receivers detected</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-6 shadow-subtle">
            <h2 className="mb-6 text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-blue-500" /> System Telemetry
            </h2>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[...reports].reverse()}>
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                  <XAxis 
                    dataKey="inserted_at" 
                    tickFormatter={(time) => {
                      try { return format(new Date(time), "HH:mm"); } catch { return ""; }
                    }}
                    stroke="#3f3f46"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#3f3f46" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                    unit="°"
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", color: "#f4f4f5", borderRadius: "6px", fontSize: "11px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)" }}
                    labelFormatter={(label) => {
                      try { return format(new Date(label), "HH:mm:ss"); } catch { return ""; }
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="temp" 
                    stroke="#3b82f6" 
                    strokeWidth={1.5}
                    fillOpacity={1} 
                    fill="url(#colorTemp)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-6 shadow-subtle">
            <h2 className="mb-4 text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-blue-500" /> System Logs (Serial Monitor)
            </h2>
            <div className="bg-black/40 rounded-md border border-zinc-800/50 p-3 font-mono text-[10px] space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <div key={log.id} className="flex gap-2 leading-relaxed">
                    <span className="text-zinc-600 shrink-0">[{format(new Date(log.timestamp), "HH:mm:ss")}]</span>
                    <span className={cn(
                      "font-bold shrink-0",
                      log.type === "error" ? "text-red-500" : 
                      log.type === "success" ? "text-emerald-500" : 
                      log.type === "warn" ? "text-amber-500" : "text-blue-500"
                    )}>
                      {String(log.node_id).toUpperCase()}:
                    </span>
                    <span className="text-zinc-300 break-all">{log.message}</span>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-zinc-700 italic">
                  No active log stream...
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-6 shadow-subtle">
            <h2 className="mb-4 text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <History className="h-3.5 w-3.5 text-blue-500" /> Event Stream
            </h2>
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
              {reports.slice(0, 15).map((report) => (
                <div key={report.id} className="group flex flex-col gap-1.5 border-l-2 border-zinc-800 pl-4 py-1 transition-colors hover:border-blue-500/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-zinc-500">
                      {tryFormat(report.inserted_at)}
                    </span>
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded",
                      report.danger ? "bg-red-500/10 text-red-400" : "bg-zinc-800 text-zinc-400"
                    )}>
                      NODE {report.node_id}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300">
                    Sensor payload received: <span className="text-zinc-500">{report.temp}°C / {report.hum}% RH</span>
                  </p>
                </div>
              ))}
              {reports.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-xs text-zinc-600">Waiting for incoming telemetry stream...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
}

function tryFormat(dateStr: string) {
  try {
    return format(new Date(dateStr), "HH:mm:ss.SS");
  } catch {
    return "00:00:00";
  }
}
