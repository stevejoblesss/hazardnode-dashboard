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
  Terminal, 
  Settings, 
  Save, 
  Loader2, 
  Undo2,
  Languages
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

const translations = {
  en: {
    missionControl: "Mission Control",
    dashboard: "Dashboard",
    systemNominal: "SYSTEM NOMINAL",
    alertsActive: "ALERTS ACTIVE",
    nodesOnline: "NODES ONLINE",
    connecting: "CONNECTING...",
    connError: "CONNECTION ERROR",
    testAlerts: "TEST ALERTS",
    activeDevices: "Active Device Units",
    receiverHubs: "Receiver Hubs",
    deviceManagement: "Device Management & Provisioning",
    noSensors: "No sensors detected",
    noReceivers: "No receivers detected",
    macAddress: "MAC Address",
    deviceName: "Device Name",
    assignedWifi: "Assigned WiFi",
    lastRequest: "Last Request",
    action: "Action",
    noDevices: "No devices registered in the system yet.",
    systemTelemetry: "System Telemetry",
    systemLogs: "System Logs (Serial Monitor)",
    eventStream: "Event Stream",
    noLogs: "No active log stream...",
    waitingTelemetry: "Waiting for incoming telemetry stream...",
    temp: "Temperature",
    hum: "Humidity",
    signal: "Signal Strength",
    orientation: "Orientation",
    smokeAnalysis: "Smoke Analysis",
    edgeAi: "Edge AI Inference",
    classification: "Classification",
    source: "Source",
    onDevice: "ON-DEVICE",
    criticalAlert: "CRITICAL ALERT",
    atmosphereClear: "ATMOSPHERE CLEAR",
    normal: "NORMAL",
    warning: "WARNING",
    hazard: "HAZARD",
    excellent: "Excellent",
    good: "Good",
    fair: "Fair",
    weak: "Weak",
    offline: "OFFLINE",
    online: "ONLINE",
    systemGateway: "System Gateway",
    deviceUnit: "Device Unit",
    manageDevice: "Manage Device",
    placeholderWifi: "WiFi SSID",
    placeholderPass: "New Password",
    placeholderName: "Device Name",
    never: "Never",
    heartbeat: "Gateway heart-beat received",
    payloadReceived: "Sensor payload received",
    noData: "No telemetry data"
  },
  zh: {
    missionControl: "控制中心",
    dashboard: "仪表板",
    systemNominal: "系统正常",
    alertsActive: "警报激活",
    nodesOnline: "节点在线",
    connecting: "连接中...",
    connError: "连接错误",
    testAlerts: "发送测试警报",
    activeDevices: "活跃设备单元",
    receiverHubs: "接收网关",
    deviceManagement: "设备管理与配置",
    noSensors: "未检测到传感器",
    noReceivers: "未检测到接收器",
    macAddress: "MAC 地址",
    deviceName: "设备名称",
    assignedWifi: "分配的 WiFi",
    lastRequest: "最后请求",
    action: "操作",
    noDevices: "系统中尚未注册任何设备。",
    systemTelemetry: "系统遥测数据",
    systemLogs: "系统日志 (串口监控)",
    eventStream: "事件流",
    noLogs: "无活跃日志流...",
    waitingTelemetry: "等待遥测数据流...",
    temp: "温度",
    hum: "湿度",
    signal: "信号强度",
    orientation: "姿态角度",
    smokeAnalysis: "烟雾分析",
    edgeAi: "边缘 AI 推理",
    classification: "分类结果",
    source: "来源",
    onDevice: "设备端运行",
    criticalAlert: "严重危险警报",
    atmosphereClear: "空气质量正常",
    normal: "正常",
    warning: "警告",
    hazard: "危险",
    excellent: "极好",
    good: "良好",
    fair: "一般",
    weak: "弱",
    offline: "离线",
    online: "在线",
    systemGateway: "系统网关",
    deviceUnit: "设备单元",
    manageDevice: "管理设备",
    placeholderWifi: "WiFi 名称 (SSID)",
    placeholderPass: "新密码",
    placeholderName: "设备显示名称",
    never: "从未",
    heartbeat: "收到网关心跳",
    payloadReceived: "收到传感器数据",
    noData: "无遥测数据"
  }
};

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
  mac_address?: string;
  custom_name?: string;
}

interface LogEntry {
  id: string;
  message: string;
  timestamp: string;
  type: "info" | "error" | "success" | "warn";
  node_id: string | number;
}

const getRssiDisplay = (rssi: number | undefined | null, isOnline: boolean, t: any) => {
  if (!isOnline || rssi === undefined || rssi === null) return { icon: WifiOff, color: "text-zinc-500", label: t.offline };
  if (rssi >= -50) return { icon: Wifi, color: "text-emerald-500", label: t.excellent };
  if (rssi >= -70) return { icon: Wifi, color: "text-blue-500", label: t.good };
  if (rssi >= -85) return { icon: Wifi, color: "text-amber-500", label: t.fair };
  return { icon: Wifi, color: "text-red-500", label: t.weak };
};

interface NodeCardProps {
  node: NodeReport;
  isOnline: boolean;
  deviceName?: string;
  t: any;
}

const NodeCard = ({ 
  node, 
  isOnline,
  deviceName,
  t
}: NodeCardProps) => {
  const rssiDisplay = getRssiDisplay(node.rssi, isOnline, t);
  const lastSeen = formatDistanceToNow(new Date(node.inserted_at), { addSuffix: true });
  const isReceiver = node.type === "receiver";
  const isSender = node.type === "sender";

  // Edge AI classification logic (0=Normal, 1=Warning, 2=Hazard)
  const getEdgeAiLabel = (cls?: number) => {
    switch(cls) {
      case 1: return { label: t.warning, color: "text-amber-400", bg: "bg-amber-500/5" };
      case 2: return { label: t.hazard, color: "text-red-400", bg: "bg-red-500/5" };
      default: return { label: t.normal, color: "text-emerald-400", bg: "bg-emerald-500/5" };
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
              {isReceiver ? t.systemGateway : t.deviceUnit}
            </span>
            <h3 className="text-xl font-bold text-white leading-tight">
              {deviceName || node.custom_name || (isReceiver 
                ? `Gateway ${String(node.node_id).replace(/[^0-9]/g, '') || node.node_id}`
                : (typeof node.node_id === 'number' ? `Node ${String(node.node_id).padStart(2, '0')}` : node.node_id))
              }
            </h3>
            {node.mac_address && (
              <span className="text-[9px] font-mono text-zinc-600 block mt-0.5">
                MAC: {node.mac_address}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 mb-1">
              {!isSender && <rssiDisplay.icon className={cn("h-3.5 w-3.5", rssiDisplay.color)} />}
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", rssiDisplay.color)}>
                {isSender 
                  ? (isOnline ? t.online : t.offline)
                  : (isOnline && node.rssi ? `${node.rssi} dBm` : rssiDisplay.label)
                }
              </span>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Clock className="h-3 w-3 text-zinc-500" />
              <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">
                {lastSeen}
              </span>
            </div>
          </div>
          {node.mac_address && (
            <button 
              onClick={() => {
                const el = document.getElementById(`device-${node.mac_address}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                  el.classList.add('bg-emerald-500/10');
                  setTimeout(() => el.classList.remove('bg-emerald-500/10'), 3000);
                }
              }}
              className="p-1.5 rounded-md bg-zinc-800/50 border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all"
              title={t.manageDevice}
            >
              <Settings className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {!isReceiver ? (
        <>
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Thermometer className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{t.temp}</span>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-white">
                {node.temp !== null ? node.temp : "---"}<span className="text-sm text-zinc-500 ml-0.5">°C</span>
              </p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Droplets className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{t.hum}</span>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-white">
                {node.hum !== null ? node.hum : "---"}<span className="text-sm text-zinc-500 ml-0.5">%</span>
              </p>
            </div>

            {!isSender && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Wifi className="h-3 w-3" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{t.signal}</span>
                </div>
                <p className={cn(
                  "text-sm font-medium font-mono",
                  rssiDisplay.color
                )}>
                  {isOnline && node.rssi ? `${node.rssi} dBm` : "---"} <span className="text-[10px] opacity-70 ml-1">({rssiDisplay.label})</span>
                </p>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Compass className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{t.orientation}</span>
              </div>
              <p className="text-sm font-medium text-white font-mono">
                P: {node.pitch.toFixed(1)}° <span className="text-zinc-600 mx-1">/</span> R: {node.roll.toFixed(1)}°
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Wind className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{t.smokeAnalysis}</span>
              </div>
              <p className={cn(
                "text-xs font-bold uppercase tracking-widest",
                node.smoke_digital ? "text-red-400" : "text-emerald-400"
              )}>
                {node.smoke_digital ? t.criticalAlert : t.atmosphereClear}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/50">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">{t.edgeAi}</span>
            </div>
            
            <div className={cn("flex items-center justify-between border border-white/5 rounded-md p-2", edgeAi.bg)}>
              <div>
                <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider block mb-0.5">{t.classification}</span>
                <span className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  edgeAi.color
                )}>
                  {edgeAi.label}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider block mb-0.5">{t.source}</span>
                <span className="text-[10px] font-mono font-bold text-blue-400/80 uppercase">
                  {t.onDevice}
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

const DeviceRow = ({ mac, device, isUpdating, onUpdate, t }: { 
  mac: string; 
  device: any; 
  isUpdating: boolean;
  onUpdate: (mac: string, name: string, ssid?: string, password?: string) => Promise<void>;
  t: any;
}) => {
  const [name, setName] = useState(device.config?.name || "");
  const [ssid, setSsid] = useState(device.config?.wifi?.ssid || "");
  const [password, setPassword] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  return (
    <tr id={`device-${mac}`} className="hover:bg-white/5 transition-all group">
      <td className="py-4 px-2 font-mono text-zinc-400">{mac}</td>
      <td className="py-4 px-2">
        {isEditing ? (
          <input 
            type="text" 
            value={name} 
            placeholder={t.placeholderName}
            onChange={(e) => setName(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white w-full focus:outline-none focus:border-emerald-500"
          />
        ) : (
          <span className="text-white font-medium">{device.config?.name || "---"}</span>
        )}
      </td>
      <td className="py-4 px-2">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <input 
              type="text" 
              value={ssid} 
              placeholder={t.placeholderWifi}
              onChange={(e) => setSsid(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white w-full focus:outline-none focus:border-emerald-500"
            />
            <input 
              type="password" 
              value={password} 
              placeholder={t.placeholderPass}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white w-full focus:outline-none focus:border-emerald-500"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-zinc-300">{device.config?.wifi?.ssid || t.offline}</span>
            {device.config?.wifi?.ssid && (
              <span className="text-[9px] text-zinc-600 font-mono italic">Has password set</span>
            )}
          </div>
        )}
      </td>
      <td className="py-4 px-2 text-zinc-500">
        {device.last_provision_request 
          ? formatDistanceToNow(new Date(device.last_provision_request), { addSuffix: true }) 
          : t.never
        }
      </td>
      <td className="py-4 px-2">
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button 
                onClick={async () => {
                  await onUpdate(mac, name, ssid, password);
                  setIsEditing(false);
                  setPassword(""); // Clear local password state
                }}
                disabled={isUpdating}
                className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
              >
                {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </button>
              <button 
                onClick={() => {
                  setIsEditing(false);
                  setName(device.config?.name || "");
                  setSsid(device.config?.wifi?.ssid || "");
                  setPassword("");
                }}
                className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

export default function Dashboard() {
  const [reports, setReports] = useState<NodeReport[]>([]);
  const [nodes, setNodes] = useState<Record<string, NodeReport>>({});
  const [deviceRegistry, setDeviceRegistry] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "error" | "reconnecting">("connecting");
  const [now, setNow] = useState(new Date());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [updatingDevice, setUpdatingDevice] = useState<string | null>(null);
  const [isTestingAlert, setIsTestingAlert] = useState(false);
  const [lang, setLang] = useState<"en" | "zh">("en");

  const t = translations[lang];

  const sendTestAlert = async () => {
    setIsTestingAlert(true);
    try {
      const res = await fetch("/api/node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: "DASHBOARD_TEST",
          temp: 25.5,
          hum: 60,
          pitch: 0,
          roll: 0,
          smoke_analog: 450,
          smoke_digital: false,
          danger: false,
          is_test: true
        }),
      });
      if (res.ok) {
        alert(lang === "en" ? "✅ Test alert sent! Check your Telegram and Feishu." : "✅ 测试警报已发送！请检查 Telegram 和飞书。");
      } else {
        throw new Error("Failed to send test alert");
      }
    } catch (err) {
      console.error("Test alert failed:", err);
      alert(lang === "en" ? "❌ Failed to send test alert." : "❌ 发送测试警报失败。");
    } finally {
      setIsTestingAlert(false);
    }
  };

  const handleUpdateDeviceConfig = async (macAddress: string, name: string, ssid?: string, password?: string) => {
    setUpdatingDevice(macAddress);
    try {
      const config: any = { name };
      if (ssid) config.wifi = { ssid, password: password || "" };

      const res = await fetch("/api/provisioning/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac_address: macAddress, config }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      setUpdatingDevice(null);
    }
  };

  // Periodically update the "now" time to keep "Last Seen" and "Online" counts accurate
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 2000); // Update every 2s for 10s threshold
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!rtdb) return;

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

    // 4. Listen for device registry
    const registryRef = ref(rtdb, "device_registry");
    const unsubscribeRegistry = onValue(registryRef, (snapshot) => {
      if (snapshot.exists()) {
        setDeviceRegistry(snapshot.val());
      }
    });

    return () => {
      unsubscribeConn();
      unsubscribeNodes();
      unsubscribeReports();
      unsubscribeLogs();
      unsubscribeRegistry();
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
  
  // Staleness thresholds: 15s for standard nodes, 30s for receivers
  // Use a 10s buffer to account for clock drift between server and client
  const STALE_THRESHOLD = 15 * 1000 + 10000; 
  const RECEIVER_STALE_THRESHOLD = 30 * 1000 + 10000;

  const onlineNodes = activeNodes.filter(n => {
    const lastSeenTime = new Date(n.inserted_at).getTime();
    const threshold = n.type === "receiver" ? RECEIVER_STALE_THRESHOLD : STALE_THRESHOLD;
    return (now.getTime() - lastSeenTime) < threshold;
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
            <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">{t.missionControl}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            HazardNode <span className="text-zinc-500 font-medium">{t.dashboard}</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(l => l === "en" ? "zh" : "en")}
            className="flex items-center gap-2 rounded-md bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-emerald-400 transition-all shadow-subtle"
          >
            <Languages className="h-3.5 w-3.5" />
            {lang === "en" ? "中文" : "English"}
          </button>
          <button
            onClick={sendTestAlert}
            disabled={isTestingAlert}
            className="flex items-center gap-2 rounded-md bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-blue-400 transition-all shadow-subtle disabled:opacity-50"
          >
            {isTestingAlert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {t.testAlerts}
          </button>
          <div className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold shadow-subtle border transition-colors duration-500",
            dangerNodes.length > 0 
              ? "bg-red-500/10 border-red-500/50 text-red-500 animate-pulse" 
              : "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
          )}>
            {dangerNodes.length > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {dangerNodes.length > 0 ? `${dangerNodes.length} ${t.alertsActive.toUpperCase()}` : t.systemNominal}
          </div>
          <div className="flex items-center gap-2 rounded-md bg-zinc-900/50 border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 shadow-subtle">
            <Activity className={cn(
              "h-3.5 w-3.5",
              connectionStatus === "connected" ? "text-blue-500" : connectionStatus === "error" ? "text-red-500" : "text-zinc-500 animate-pulse"
            )} />
            {connectionStatus === "connected" ? `${onlineNodes.length} ${t.nodesOnline.toUpperCase()}` : connectionStatus === "error" ? t.connError : t.connecting}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-12">
          {/* Sensor Nodes Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" /> {t.activeDevices}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sensorNodes.length > 0 ? (
                sensorNodes.map((node) => {
                  const isOnline = (now.getTime() - new Date(node.inserted_at).getTime()) < STALE_THRESHOLD;
                  const registeredDevice = node.mac_address ? deviceRegistry[node.mac_address] : null;
                  return (
                    <NodeCard 
                      key={node.node_id} 
                      node={node} 
                      isOnline={isOnline}
                      deviceName={registeredDevice?.config?.name}
                      t={t}
                    />
                  );
                })
              ) : (
                <div className="col-span-full py-10 flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/10">
                  <Activity className="h-6 w-6 text-zinc-700 mb-2 animate-pulse" />
                  <p className="text-xs text-zinc-600 uppercase tracking-widest font-bold">{t.noSensors}</p>
                </div>
              )}
            </div>
          </div>

          {/* Receiver Nodes Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Server className="h-4 w-4 text-amber-500" /> {t.receiverHubs}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {receiverNodes.length > 0 ? (
                receiverNodes.map((node) => {
                  const isOnline = (now.getTime() - new Date(node.inserted_at).getTime()) < RECEIVER_STALE_THRESHOLD;
                  const registeredDevice = node.mac_address ? deviceRegistry[node.mac_address] : null;
                  return (
                    <NodeCard 
                      key={node.node_id} 
                      node={node} 
                      isOnline={isOnline}
                      deviceName={registeredDevice?.config?.name}
                      t={t}
                    />
                  );
                })
              ) : (
                <div className="col-span-full py-10 flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/10">
                  <Server className="h-6 w-6 text-zinc-700 mb-2 animate-pulse" />
                  <p className="text-xs text-zinc-600 uppercase tracking-widest font-bold">{t.noReceivers}</p>
                </div>
              )}
            </div>
          </div>

          {/* Provisioning Management Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-500" /> {t.deviceManagement}
              </h2>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider font-bold">
                      <th className="pb-3 px-2">{t.macAddress}</th>
                      <th className="pb-3 px-2">{t.deviceName}</th>
                      <th className="pb-3 px-2">{t.assignedWifi}</th>
                      <th className="pb-3 px-2">{t.lastRequest}</th>
                      <th className="pb-3 px-2">{t.action}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {Object.entries(deviceRegistry).map(([mac, device]: [string, any]) => (
                      <DeviceRow 
                        key={mac} 
                        mac={mac} 
                        device={device} 
                        isUpdating={updatingDevice === mac}
                        onUpdate={handleUpdateDeviceConfig}
                        t={t}
                      />
                    ))}
                    {Object.keys(deviceRegistry).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-zinc-600 italic">
                          {t.noDevices}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-6 shadow-subtle">
            <h2 className="mb-6 text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-blue-500" /> {t.systemTelemetry}
            </h2>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[...reports].filter(r => r.temp !== null && r.temp !== undefined).reverse()}>
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
              <Terminal className="h-3.5 w-3.5 text-blue-500" /> {t.systemLogs}
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
                  {t.noLogs}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-6 shadow-subtle">
            <h2 className="mb-4 text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <History className="h-3.5 w-3.5 text-blue-500" /> {t.eventStream}
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
                    {report.type === "receiver" 
                      ? `${t.heartbeat}: RSSI ${report.rssi || '?' } dBm` 
                      : `${t.payloadReceived}: ${report.temp !== null ? `${report.temp}°C / ${report.hum}% RH` : t.noData}`
                    }
                  </p>
                </div>
              ))}
              {reports.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-xs text-zinc-600">{t.waitingTelemetry}</p>
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
