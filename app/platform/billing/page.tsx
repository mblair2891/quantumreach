import { prisma } from "@/lib/db/prisma";

const short = (value?: string | null) => value ? `${value.slice(0, 10)}…${value.slice(-6)}` : "—";
export default async function PlatformBillingPage() {
  const [orders, subscriptions, events] = await Promise.all([
    prisma.customerOrder.findMany({ orderBy: { updatedAt: "desc" }, take: 100, include: { infrastructureOrder: true, simulatedPayment: true } }),
    prisma.saasSubscription.findMany({ orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.stripeWebhookEvent.findMany({ where: { status: "FAILED" }, orderBy: { receivedAt: "desc" }, take: 50 }),
  ]);
  const orderIds = orders.map(order => order.id);
  const [payments, disputes] = await Promise.all([
    prisma.stripePaymentRecord.findMany({ where: { customerOrderId: { in: orderIds } } }),
    prisma.stripeDisputeRecord.findMany({ where: { customerOrderId: { in: orderIds }, status: { notIn: ["won", "closed"] } } }),
  ]);
  const paymentByOrder = new Map(payments.map(payment => [payment.customerOrderId, payment]));
  const disputeByOrder = new Map(disputes.map(dispute => [dispute.customerOrderId, dispute]));
  return <main className="space-y-8"><header><h1>Billing operations</h1><p>Provider identifiers, clearance state, test-payment evidence, refunds, disputes, subscriptions, and safely recorded webhook failures.</p></header>
    <section className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead><tr><th>Order</th><th>Provider / clearance</th><th>Stripe references</th><th>Payment</th><th>Refund / dispute</th><th>Setup</th></tr></thead><tbody>{orders.map(order => { const payment = paymentByOrder.get(order.id); const dispute = disputeByOrder.get(order.id); return <tr key={order.id} className="border-t align-top"><td>{short(order.id)}<br /><span className="text-slate-500">{short(order.userId)}</span></td><td>{order.paymentMethod}<br />{order.paymentStatus}</td><td>Customer {short(order.stripeCustomerId)}<br />Checkout {short(order.stripeCheckoutSessionId)}<br />Payment {short(order.stripePaymentIntentId)}<br />Subscription {short(order.stripeSubscriptionId)}</td><td>{order.simulatedPayment ? <span className="font-semibold text-indigo-700">SIMULATED TEST · no collected revenue<br/>{order.simulatedPayment.amountCents} {order.simulatedPayment.currency}</span> : payment?.paidAt?.toLocaleString() ?? "No verified payment"}</td><td>{order.refundedAmountCents ? `${order.refundedAmountCents} refunded` : "No refund"}<br />{dispute ? `Dispute: ${dispute.status}` : "No active dispute"}</td><td>{order.infrastructureOrder?.status ?? "No setup order"}</td></tr>; })}</tbody></table>{!orders.length && <p className="p-5">No customer orders.</p>}</section>
    <section><h2>Subscriptions</h2><div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead><tr><th>Workspace</th><th>Status</th><th>Stripe customer</th><th>Stripe subscription</th><th>Period end</th></tr></thead><tbody>{subscriptions.map(subscription => <tr key={subscription.id} className="border-t"><td>{short(subscription.workspaceId)}</td><td>{subscription.status}</td><td>{short(subscription.stripeCustomerId)}</td><td>{short(subscription.stripeSubscriptionId)}</td><td>{subscription.currentPeriodEnd?.toLocaleString() ?? "—"}</td></tr>)}</tbody></table></div></section>
    <section><h2>Webhook failures</h2><div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead><tr><th>Received</th><th>Event</th><th>Status</th><th>Retries</th><th>Safe error</th></tr></thead><tbody>{events.map(event => <tr key={event.id} className="border-t"><td>{event.receivedAt.toLocaleString()}</td><td>{event.eventType} · {short(event.stripeEventId)}</td><td>{event.status}</td><td>{event.retryCount}</td><td>{event.safeError ?? "—"}</td></tr>)}</tbody></table>{!events.length && <p className="p-5">No failed Stripe webhook events.</p>}</div></section>
  </main>;
}
