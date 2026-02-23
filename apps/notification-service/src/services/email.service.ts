import { Resend } from "resend";
import { logger } from "@ayurveda/shared-utils";

const resend = new Resend(process.env["RESEND_API_KEY"] ?? "");
const RESEND_FROM = process.env["RESEND_FROM"] ?? "noreply@ayurveda.store";

export async function sendOrderCreatedEmail(
  email: string,
  orderId: string,
  totalAmount: string,
) {
  const subject = "Your order has been placed! 🌿";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Order Confirmed!</h2>
      <p>Your order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> has been placed successfully.</p>
      <p>Total: <strong>₹${totalAmount}</strong></p>
      <p>We'll notify you once your payment is confirmed and your order is dispatched.</p>
      <p>— Ayurveda Store Team 🌿</p>
    </div>
  `;
  await resend.emails.send({ from: RESEND_FROM, to: email, subject, html });
}

export async function sendPaymentCapturedEmail(email: string, orderId: string) {
  const subject = "Payment confirmed — your order is being packed! ✅";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Payment Received!</h2>
      <p>Payment for order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> has been confirmed.</p>
      <p>Your order is now being prepared for dispatch.</p>
      <p>— Ayurveda Store Team 🌿</p>
    </div>
  `;
  await resend.emails.send({ from: RESEND_FROM, to: email, subject, html });
}

export async function sendPaymentFailedEmail(email: string, orderId: string) {
  const subject = "Payment failed for your order";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Payment Failed</h2>
      <p>Unfortunately, payment for order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> could not be processed.</p>
      <p>Please try again or contact support.</p>
      <p>— Ayurveda Store Team 🌿</p>
    </div>
  `;
  await resend.emails.send({ from: RESEND_FROM, to: email, subject, html });
}
