import { z } from 'zod';

export const workflowTaskSchema = z.object({
  id: z.string().min(3).max(120).regex(/^[a-z0-9-]+$/),
  capability: z.string().min(3).max(120),
  dependsOn: z.array(z.string().min(1)).default([]),
  inputs: z.array(z.string().min(1)).default([]),
  outputs: z.array(z.string().min(1)).default([]),
  tools: z.array(z.string().min(1)).default([]),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
});

export const workflowPlanSchema = z.object({
  objective: z.string().min(10),
  clarificationRequired: z.boolean().default(false),
  clarifications: z.array(z.string().min(1)).default([]),
  tasks: z.array(workflowTaskSchema).min(1).max(40),
  qualityGates: z.array(z.string().min(1)).default([]),
  artifactIntent: z.array(z.string().min(1)).default([]),
  budgets: z.object({
    maxTasks: z.number().int().min(1).max(100).default(24),
    maxRepairCycles: z.number().int().min(0).max(5).default(2),
    maxParallelTasks: z.number().int().min(1).max(12).default(4),
  }).default({ maxTasks: 24, maxRepairCycles: 2, maxParallelTasks: 4 }),
});
