import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    stripe = new Stripe(key);
  }
  return stripe;
}

/** True when STRIPE_SECRET_KEY is set in env; required for Stripe payment links on invoices. */
export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export interface CreatePaymentLinkParams {
  invoiceId: string;
  amountCents: number;
  currency?: string;
  description?: string;
}

/** Create a Stripe Payment Link for an invoice. Returns url and id; store id on invoice. */
export async function createPaymentLink(
  params: CreatePaymentLinkParams
): Promise<{ url: string; id: string } | null> {
  const client = getStripe();
  if (!client) return null;

  const { invoiceId, amountCents, currency = "aud", description } = params;
  const amount = Math.round(amountCents);
  if (amount <= 0) return null;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency,
        unit_amount: amount,
        product_data: {
          name: description ?? `Invoice ${invoiceId}`,
          description: `Payment for invoice`,
        },
      },
      quantity: 1,
    },
  ];

  const session = await client.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: `${process.env.APP_URL ?? ""}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL ?? ""}/pay/cancel`,
    metadata: { invoiceId },
  });

  if (!session.url) return null;
  return { url: session.url, id: session.id };
}
