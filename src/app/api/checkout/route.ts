import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      amount, 
      description, 
      customerEmail, 
      customerName,
      metadata = {},
      successUrl,
      cancelUrl 
    } = body;

    if (!amount || !description || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, description, customerEmail' },
        { status: 400 }
      );
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: description,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: customerEmail,
      metadata: {
        ...metadata,
        customerName: customerName || '',
      },
      success_url: successUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://californiamailer.com'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://californiamailer.com'}/payment-cancelled`,
    });

    return NextResponse.json({ 
      sessionId: session.id, 
      url: session.url 
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Error creating checkout session' },
      { status: 500 }
    );
  }
}
