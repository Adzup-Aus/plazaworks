import { db } from "../db";
import { organizationCounters, organizationSettings } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";

const COUNTER_KEY = "job_invoice";

export interface NumberReservation {
  referenceNumber: number;
  jobNumber: string;
  invoiceNumber: string;
}

export async function reserveNextNumber(organizationId: string): Promise<NumberReservation> {
  const settings = await db.query.organizationSettings.findFirst({
    where: eq(organizationSettings.organizationId, organizationId),
  });

  const jobPrefix = settings?.jobNumberPrefix || "J-";
  const invoicePrefix = settings?.invoiceNumberPrefix || "INV-";

  const result = await db.execute(sql`
    INSERT INTO organization_counters (organization_id, counter_key, next_value, prefix, pad_length, created_at, updated_at)
    VALUES (${organizationId}, ${COUNTER_KEY}, 2, '', 4, NOW(), NOW())
    ON CONFLICT (organization_id, counter_key)
    DO UPDATE SET 
      next_value = organization_counters.next_value + 1,
      updated_at = NOW()
    RETURNING next_value - 1 as reserved_value, pad_length
  `);

  const row = result.rows[0] as { reserved_value: number; pad_length: number };
  const reservedValue = row.reserved_value;
  const padLength = row.pad_length || 4;
  const paddedNumber = String(reservedValue).padStart(padLength, "0");

  return {
    referenceNumber: reservedValue,
    jobNumber: `${jobPrefix}${paddedNumber}`,
    invoiceNumber: `${invoicePrefix}${paddedNumber}`,
  };
}

export async function generateJobName(clientName: string, suburb: string | null): Promise<string> {
  const cleanedClientName = clientName.trim();
  const cleanedSuburb = suburb?.trim() || "";
  
  if (cleanedSuburb) {
    return `${cleanedClientName} | ${cleanedSuburb}`;
  }
  return cleanedClientName;
}

export function extractSuburbFromAddress(address: string): string | null {
  if (!address) return null;
  
  const lines = address.split(/[,\n]/).map(line => line.trim()).filter(Boolean);
  
  const australianStatePattern = /\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s*\d{4}\b/i;
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(australianStatePattern);
    if (match) {
      const beforeState = lines[i].substring(0, match.index).trim();
      const lastWord = beforeState.split(/\s+/).pop();
      if (lastWord && lastWord.length > 2) {
        return lastWord.charAt(0).toUpperCase() + lastWord.slice(1).toLowerCase();
      }
    }
  }
  
  if (lines.length >= 2) {
    const secondLastLine = lines[lines.length - 2];
    if (secondLastLine && !secondLastLine.match(/^\d+/)) {
      return secondLastLine.split(/\s+/)[0];
    }
  }
  
  return null;
}

export function generatePaymentLinkToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
