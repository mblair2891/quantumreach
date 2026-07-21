"use server";
import { revalidatePath } from "next/cache";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { cancelInfrastructureJobByOperator, retryInfrastructureJobByOperator } from "@/lib/jobs/service";
export async function retryJob(form: FormData) { await requireOperatorAccess(); await retryInfrastructureJobByOperator(String(form.get("jobId"))); revalidatePath("/platform/infrastructure-jobs"); }
export async function cancelJob(form: FormData) { await requireOperatorAccess(); await cancelInfrastructureJobByOperator(String(form.get("jobId"))); revalidatePath("/platform/infrastructure-jobs"); }
