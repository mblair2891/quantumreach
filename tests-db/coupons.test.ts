import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { buildAcquisitionChargeSummary } from "@/lib/commercial/charge-lines";
import { applyCoupon } from "@/lib/commercial/coupons";

const db = new PrismaClient();
const suffix = `DB${randomUUID().replaceAll("-", "")}`;
const couponIds: string[] = [];
const orderIds: string[] = [];

const couponData = (normalizedCode: string, overrides: Record<string, unknown> = {}) => ({
  code: normalizedCode,
  normalizedCode,
  displayName: `DB coupon ${normalizedCode}`,
  active: true,
  percentageOff: 100,
  eligiblePackageKeys: ["GROWTH_SENDER_PACKAGE"],
  eligibleProductKeys: [],
  eligibleChargeTypes: ["IMPLEMENTATION_FEE"],
  ...overrides,
});

const summary = buildAcquisitionChargeSummary("GROWTH_SENDER_PACKAGE", {
  productKey: "STANDARD_SETUP",
  displayName: "Standard",
  amountCents: 0,
});

afterAll(async () => {
  try {
    await db.couponRedemption.deleteMany({ where: { couponId: { in: couponIds } } });
    await db.customerOrder.deleteMany({ where: { id: { in: orderIds } } });
    await db.commercialCoupon.deleteMany({ where: { id: { in: couponIds } } });
  } finally {
    await db.$disconnect();
  }
});

describe("PostgreSQL coupon lifecycle", () => {
  it("enforces normalized-code uniqueness without aborting later assertions", async () => {
    const code = `${suffix}UNIQUE`;
    const coupon = await db.commercialCoupon.create({ data: couponData(code) });
    couponIds.push(coupon.id);

    await expect(db.commercialCoupon.create({
      data: couponData(code, { code: code.toLowerCase(), displayName: "Duplicate" }),
    })).rejects.toMatchObject({ code: "P2002" });

    expect(await db.commercialCoupon.findUnique({ where: { normalizedCode: code } })).toMatchObject({ id: coupon.id });
  });

  it("persists APPLIED and RESERVED states, retry idempotency, counts, and immutable snapshots", async () => {
    const code = `${suffix}LIFECYCLE`;
    const coupon = await db.commercialCoupon.create({ data: couponData(code, { maximumTotalRedemptions: 2, maximumRedemptionsPerCustomer: 1 }) });
    couponIds.push(coupon.id);
    const session = `${suffix}-session-lifecycle`;
    const customer = `${suffix}-customer`;
    const calculationSnapshot = { todaySubtotalCents: 209700, totalCouponSavingsCents: 150000, todayTotalCents: 59700 };

    const applied = await db.couponRedemption.create({ data: {
      couponId: coupon.id,
      acquisitionSessionId: session,
      normalizedCodeSnapshot: code,
      couponVersion: coupon.version,
      idempotencyKey: `coupon:${suffix}:lifecycle`,
      calculationSnapshot,
    } });
    expect(applied.status).toBe("APPLIED");

    await expect(db.couponRedemption.create({ data: {
      couponId: coupon.id,
      acquisitionSessionId: `${session}-retry`,
      normalizedCodeSnapshot: code,
      couponVersion: coupon.version,
      idempotencyKey: `coupon:${suffix}:lifecycle`,
      calculationSnapshot,
    } })).rejects.toMatchObject({ code: "P2002" });

    const order = await db.customerOrder.create({ data: {
      id: `${suffix}-order`,
      userId: customer,
      acceptedCouponSnapshot: { ...calculationSnapshot, normalizedCode: code, couponVersion: coupon.version },
    } });
    orderIds.push(order.id);
    const reserved = await db.couponRedemption.update({ where: { id: applied.id }, data: {
      status: "RESERVED",
      reservedAt: new Date(),
      customerAccountId: customer,
      orderId: order.id,
    } });
    expect(reserved.status).toBe("RESERVED");
    expect(await db.couponRedemption.count({ where: { couponId: coupon.id, status: { in: ["RESERVED", "REDEEMED"] } } })).toBe(1);
    expect(await db.couponRedemption.count({ where: { couponId: coupon.id, customerAccountId: customer, status: { in: ["RESERVED", "REDEEMED"] } } })).toBe(1);

    await db.commercialCoupon.update({ where: { id: coupon.id }, data: { displayName: "Edited later", version: { increment: 1 } } });
    expect((await db.couponRedemption.findUniqueOrThrow({ where: { id: applied.id } })).calculationSnapshot).toEqual(calculationSnapshot);
    expect((await db.customerOrder.findUniqueOrThrow({ where: { id: order.id } })).acceptedCouponSnapshot).toEqual({ ...calculationSnapshot, normalizedCode: code, couponVersion: 1 });
  });

  it("enforces the one-active-coupon partial index in an independent statement", async () => {
    const code = `${suffix}PARTIAL`;
    const coupon = await db.commercialCoupon.create({ data: couponData(code) });
    couponIds.push(coupon.id);
    const acquisitionSessionId = `${suffix}-one-active`;
    await db.couponRedemption.create({ data: { couponId: coupon.id, acquisitionSessionId, normalizedCodeSnapshot: code, couponVersion: 1, idempotencyKey: `${suffix}-partial-1`, calculationSnapshot: {} } });

    await expect(db.couponRedemption.create({ data: { couponId: coupon.id, acquisitionSessionId, normalizedCodeSnapshot: code, couponVersion: 1, status: "RESERVED", idempotencyKey: `${suffix}-partial-2`, calculationSnapshot: {} } })).rejects.toMatchObject({ code: "P2002" });
    expect(await db.couponRedemption.count({ where: { acquisitionSessionId, status: { in: ["APPLIED", "RESERVED"] } } })).toBe(1);
  });

  it("enforces total and per-customer redemption limits through the production service", async () => {
    const totalCode = `${suffix}TOTAL`;
    const totalCoupon = await db.commercialCoupon.create({ data: couponData(totalCode, { maximumTotalRedemptions: 1 }) });
    couponIds.push(totalCoupon.id);
    await db.couponRedemption.create({ data: { couponId: totalCoupon.id, acquisitionSessionId: `${suffix}-total-existing`, normalizedCodeSnapshot: totalCode, couponVersion: 1, status: "RESERVED", idempotencyKey: `${suffix}-total-existing`, calculationSnapshot: {} } });
    await expect(applyCoupon({ acquisitionSessionId: `${suffix}-total-new`, code: totalCode.toLowerCase(), summary }, db)).rejects.toThrow("Code has reached its redemption limit.");

    const customerCode = `${suffix}CUSTOMER`;
    const customerCoupon = await db.commercialCoupon.create({ data: couponData(customerCode, { maximumTotalRedemptions: 10, maximumRedemptionsPerCustomer: 1 }) });
    couponIds.push(customerCoupon.id);
    const customerAccountId = `${suffix}-limited-customer`;
    await db.couponRedemption.create({ data: { couponId: customerCoupon.id, acquisitionSessionId: `${suffix}-customer-existing`, customerAccountId, normalizedCodeSnapshot: customerCode, couponVersion: 1, status: "REDEEMED", idempotencyKey: `${suffix}-customer-existing`, calculationSnapshot: {} } });
    await expect(applyCoupon({ acquisitionSessionId: `${suffix}-customer-new`, customerAccountId, code: customerCode, summary }, db)).rejects.toThrow("This code has already been used for this account.");
  });

  it("persists release and reversal transitions", async () => {
    const code = `${suffix}TRANSITIONS`;
    const coupon = await db.commercialCoupon.create({ data: couponData(code) });
    couponIds.push(coupon.id);
    const released = await db.couponRedemption.create({ data: { couponId: coupon.id, acquisitionSessionId: `${suffix}-released`, normalizedCodeSnapshot: code, couponVersion: 1, idempotencyKey: `${suffix}-released`, calculationSnapshot: {} } });
    const reversed = await db.couponRedemption.create({ data: { couponId: coupon.id, acquisitionSessionId: `${suffix}-reversed`, normalizedCodeSnapshot: code, couponVersion: 1, status: "REDEEMED", idempotencyKey: `${suffix}-reversed`, calculationSnapshot: {} } });

    expect((await db.couponRedemption.update({ where: { id: released.id }, data: { status: "RELEASED", releasedAt: new Date() } })).status).toBe("RELEASED");
    expect((await db.couponRedemption.update({ where: { id: reversed.id }, data: { status: "REVERSED", reversedAt: new Date() } })).status).toBe("REVERSED");
  });
});
