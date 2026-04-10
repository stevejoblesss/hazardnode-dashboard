import * as z from "zod";

export const NodeRequestBody = z.object({
  timestamp: z.number().optional(),
  nodeID: z.union([z.number(), z.string()]),
  type: z.enum(["sensor", "receiver"]).optional().default("sensor"),
  temp: z.number(),
  hum: z.number(),
  pitch: z.number(),
  roll: z.number(),
  smokeAnalog: z.number(),
  smokeDigital: z.boolean(),
  danger: z.boolean(),
  rssi: z.number().optional(),
  edgeAIClass: z.number().min(0).max(2).optional(),
});

export type NodeRequestBody = z.infer<typeof NodeRequestBody>;
