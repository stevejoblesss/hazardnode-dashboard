import * as z from "zod";

export const NodeRequestBody = z.object({
  timestamp: z.number().optional(),
  
  nodeID: z.union([z.number(), z.string()]).optional(),
  node_id: z.union([z.number(), z.string()]).optional(),
  mac_address: z.string().optional(),
  type: z.enum(["sensor", "receiver", "sender"]).optional().default("sensor"),
  temp: z.number().optional(),
  hum: z.number().optional(),
  pitch: z.number().optional(),
  roll: z.number().optional(),
  // Flexible fields to handle both camelCase and snake_case from ESP32
  smokeAnalog: z.number().optional(),
  smoke_analog: z.number().optional(),
  smokeDigital: z.boolean().optional(),
  smoke_digital: z.boolean().optional(),
  danger: z.boolean().optional(),
  rssi: z.number().optional(),
  edgeAIClass: z.number().min(0).max(2).optional(),
  edge_ai_class: z.number().min(0).max(2).optional(),
}).refine(data => {
  // 1. nodeID/node_id is always required to identify the source
  if (data.nodeID === undefined && data.node_id === undefined) return false;

  // 2. For receiver hubs, we don't require sensor data
  if (data.type === "receiver") return true;

  // 3. For sensor/sender units, we require smoke sensor data at minimum
  const hasSmokeAnalog = data.smokeAnalog !== undefined || data.smoke_analog !== undefined;
  const hasSmokeDigital = data.smokeDigital !== undefined || data.smoke_digital !== undefined;
  
  return hasSmokeAnalog && hasSmokeDigital;
}, {
  message: "Missing required fields for sensor/sender unit (smokeAnalog/smoke_analog or smokeDigital/smoke_digital)"
});

export type NodeRequestBody = z.infer<typeof NodeRequestBody>;
