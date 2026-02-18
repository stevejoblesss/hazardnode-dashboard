import * as z from "zod";

export const NodeRequestBody = z.object({
  nodeID: z.number(),
  temp: z.number(),
  hum: z.number(),
  pitch: z.number(),
  roll: z.number(),
  danger: z.boolean(),
});

export type NodeRequestBody = z.infer<typeof NodeRequestBody>;
