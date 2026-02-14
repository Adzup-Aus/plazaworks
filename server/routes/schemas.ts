import { userRoles, employmentTypes, userPermissions } from "@shared/schema";
import { z } from "zod";

export const updateStaffSchema = z.object({
  roles: z.array(z.enum(userRoles)).optional(),
  employmentType: z.enum(employmentTypes).optional(),
  permissions: z.array(z.enum(userPermissions)).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().optional(),
  skills: z.array(z.string()).optional(),
  salaryType: z.enum(["hourly", "annual"]).optional(),
  salaryAmount: z.string().optional(),
  overtimeRateMultiplier: z.string().optional(),
  overtimeThresholdHours: z.string().optional(),
  emailSignature: z.string().optional(),
  timezone: z.string().optional(),
  lunchBreakMinutes: z.number().optional(),
  lunchBreakPaid: z.boolean().optional(),
});
