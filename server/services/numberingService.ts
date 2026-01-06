import { db } from "../db";
import { organizationCounters, organizationSettings } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

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

  let counter = await db.query.organizationCounters.findFirst({
    where: and(
      eq(organizationCounters.organizationId, organizationId),
      eq(organizationCounters.counterKey, COUNTER_KEY)
    ),
  });

  if (!counter) {
    const [newCounter] = await db
      .insert(organizationCounters)
      .values({
        organizationId,
        counterKey: COUNTER_KEY,
        nextValue: 1,
        prefix: "",
        padLength: 4,
      })
      .returning();
    counter = newCounter;
  }

  const currentValue = counter.nextValue;

  await db
    .update(organizationCounters)
    .set({
      nextValue: currentValue + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(organizationCounters.organizationId, organizationId),
        eq(organizationCounters.counterKey, COUNTER_KEY)
      )
    );

  const padLength = counter.padLength || 4;
  const paddedNumber = String(currentValue).padStart(padLength, "0");

  return {
    referenceNumber: currentValue,
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
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
