import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addPayment, updateCoopSpot, getPaymentByStripeId } from '@/lib/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Check if we already processed this payment
        const existing = await getPaymentByStripeId(session.id);
        if (existing) {
          console.log('Payment already processed:', session.id);
          break;
        }

        // Record the payment
        await addPayment({
          stripePaymentId: session.id,
          stripeCustomerId: session.customer as string || undefined,
          amount: (session.amount_total || 0) / 100,
          currency: session.currency || 'usd',
          status: 'succeeded',
          description: session.metadata?.description || 'Payment',
          clientEmail: session.customer_email || '',
          clientName: session.metadata?.customerName,
          coopSpotId: session.metadata?.coopSpotId,
          invoiceId: session.metadata?.invoiceId,
          metadata: session.metadata as Record<string, string> || {},
        });

        // If this was a co-op spot payment, update the spot status
        if (session.metadata?.coopSpotId) {
          await updateCoopSpot(session.metadata.coopSpotId, {
            status: 'sold',
            paidAt: new Date(),
            stripePaymentId: session.id,
          });
        }

        console.log('Payment recorded:', session.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment failed:', paymentIntent.id);
        
        // Record failed payment
        await addPayment({
          stripePaymentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          status: 'failed',
          description: 'Failed payment',
          clientEmail: paymentIntent.receipt_email || '',
          metadata: paymentIntent.metadata as Record<string, string> || {},
        });
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log('Charge refunded:', charge.id);
        // You could update the payment record here if needed
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
