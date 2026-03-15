import * as z from "zod";

export const NodeRequestBody = z.object({
  timestamp: z.number().optional(),
  nodeID: z.number(),
  temp: z.number(),
  hum: z.number(),
  pitch: z.number(),
  roll: z.number(),
  smokeAnalog: z.number(),
  smokeDigital: z.boolean(),
  danger: z.boolean(),
  rssi: z.number().optional(),
});

export type NodeRequestBody = z.infer<typeof NodeRequestBody>;
