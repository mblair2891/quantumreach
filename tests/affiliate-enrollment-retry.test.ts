import {describe,expect,it} from "vitest";
import {Prisma} from "@prisma/client";
import {isTransientAffiliateEnrollmentError,withAffiliateEnrollmentRetry} from "@/lib/affiliates/service";
const known=(code:string,target?:string[])=>new Prisma.PrismaClientKnownRequestError("database operation failed",{code,clientVersion:"5.22.0",meta:target?{target}:undefined});
const wrapped=(message:string)=>new Prisma.PrismaClientUnknownRequestError(message,{clientVersion:"5.22.0"});
describe("affiliate enrollment transaction retry",()=>{
 it("classifies Prisma P2034 and recognized enrollment collisions",()=>{expect(isTransientAffiliateEnrollmentError(known("P2034"))).toBe(true);expect(isTransientAffiliateEnrollmentError(known("P2002",["normalizedCode"]))).toBe(true);expect(isTransientAffiliateEnrollmentError(known("P2002",["unrelatedBusinessKey"]))).toBe(false)});
 it("classifies wrapped Neon/PostgreSQL write conflicts, deadlocks, and serialization failures",()=>{for(const message of ["Transaction failed due to a write conflict or a deadlock. Please retry your transaction.","deadlock detected", "could not serialize access due to concurrent update"])expect(isTransientAffiliateEnrollmentError(wrapped(message))).toBe(true)});
 it("does not retry an untyped lookalike or permanent Prisma error",async()=>{expect(isTransientAffiliateEnrollmentError(new Error("Transaction failed due to a write conflict or a deadlock. Please retry your transaction."))).toBe(false);let attempts=0;await expect(withAffiliateEnrollmentRetry(async()=>{attempts++;throw known("P2025")})).rejects.toMatchObject({code:"P2025"});expect(attempts).toBe(1)});
 it("retries one wrapped conflict and succeeds without duplicating operation results",async()=>{let attempts=0;await expect(withAffiliateEnrollmentRetry(async()=>{attempts++;if(attempts===1)throw wrapped("Transaction failed due to a write conflict or a deadlock. Please retry your transaction.");return "created-once"})).resolves.toBe("created-once");expect(attempts).toBe(2)});
 it("bounds retry exhaustion and returns the stable safe error",async()=>{let attempts=0;await expect(withAffiliateEnrollmentRetry(async()=>{attempts++;throw known("P2034")})).rejects.toThrow("AFFILIATE_AUTOMATIC_ENROLLMENT_FAILED");expect(attempts).toBe(5)});
});
