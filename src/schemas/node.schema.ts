import * as z from "zod";

export const NodeRequestBody = z.object({
  timestamp: z.number().optional(),
  
  nodeID: z.union([z.number(), z.string()]).optional(),
  node_id: z.union([z.number(), z.string()]).optional(),
  type: z.enum(["sensor", "receiver", "sender"]).optional().default("sensor"),
  temp: z.number(),
  hum: z.number(),
  pitch: z.number(),
  roll: z.number(),
  // Flexible fields to handle both camelCase and snake_case from ESP32
  smokeAnalog: z.number().optional(),
  smoke_analog: z.number().optional(),
  smokeDigital: z.boolean().optional(),
  smoke_digital: z.boolean().optional(),
  danger: z.boolean(),
  rssi: z.number().optional(),
  edgeAIClass: z.number().min(0).max(2).optional(),
  edge_ai_class: z.number().min(0).max(2).optional(),
}).refine(data => {
  // Ensure we have at least one version of nodeID and smoke fields
  return (data.nodeID !== undefined || data.node_id !== undefined) &&
         (data.smokeAnalog !== undefined || data.smoke_analog !== undefined) &&
         (data.smokeDigital !== undefined || data.smoke_digital !== undefined);
}, {
  message: "Missing required fields (nodeID/node_id, smokeAnalog/smoke_analog, or smokeDigital/smoke_digital)"
});

export type NodeRequestBody = z.infer<typeof NodeRequestBody>;
