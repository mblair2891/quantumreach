export type RegistrantType = "INDIVIDUAL" | "ORGANIZATION";
export type OwnershipType =
  | "QUANTUM_REACH_MANAGED"
  | "WORKSPACE_OWNED"
  | "SHARED_POOL";
export type RegistrantContact = {
  legalFirstName: string;
  legalLastName: string;
  organizationName?: string | null;
  address1: string;
  address2?: string | null;
  city: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
  phone: string;
  email: string;
  registrantType: RegistrantType;
  confirmedAt?: Date | string | null;
};
export const REGISTRANT_COPY =
  "The domain registrant is the legal holder of the domain registration. Enter accurate information for the person or organization that should own the domain.";
export const REGISTRANT_ATTESTATION =
  "I confirm this registrant information is accurate, authorize Quantum Reach to register and manage this domain on the registrant's behalf, and understand Quantum Reach acts as reseller/service provider.";
const required: (keyof RegistrantContact)[] = [
  "legalFirstName",
  "legalLastName",
  "address1",
  "city",
  "stateProvince",
  "postalCode",
  "countryCode",
  "phone",
  "email",
  "registrantType",
];
export function validateRegistrantContact(
  input?: Partial<RegistrantContact> | null,
) {
  const missing = required.filter((key) => !String(input?.[key] || "").trim());
  if (
    input?.registrantType === "ORGANIZATION" &&
    !String(input.organizationName || "").trim()
  )
    missing.push("organizationName");
  if (input?.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email))
    missing.push("email");
  if (input?.countryCode && !/^[A-Z]{2}$/.test(input.countryCode))
    missing.push("countryCode");
  return { complete: missing.length === 0, missing: [...new Set(missing)] };
}
export function toRegistrantSnapshot(contact: RegistrantContact) {
  const valid = validateRegistrantContact(contact);
  if (!valid.complete)
    throw new Error(
      `Registrant profile is incomplete: ${valid.missing.join(", ")}.`,
    );
  if (!contact.confirmedAt)
    throw new Error("Registrant profile must be confirmed before purchase.");
  return {
    legalFirstName: contact.legalFirstName.trim(),
    legalLastName: contact.legalLastName.trim(),
    organizationName: contact.organizationName?.trim() || null,
    address1: contact.address1.trim(),
    address2: contact.address2?.trim() || null,
    city: contact.city.trim(),
    stateProvince: contact.stateProvince.trim(),
    postalCode: contact.postalCode.trim(),
    countryCode: contact.countryCode.trim().toUpperCase(),
    phone: contact.phone.trim(),
    email: contact.email.trim().toLowerCase(),
    registrantType: contact.registrantType,
    confirmedAt: new Date(contact.confirmedAt),
  };
}
export function getDomainServiceContact(): RegistrantContact | null {
  const c = {
    legalFirstName: process.env.DOMAIN_SERVICE_CONTACT_FIRST_NAME || "",
    legalLastName: process.env.DOMAIN_SERVICE_CONTACT_LAST_NAME || "",
    organizationName: process.env.DOMAIN_SERVICE_CONTACT_ORG || null,
    address1: process.env.DOMAIN_SERVICE_CONTACT_ADDRESS1 || "",
    address2: process.env.DOMAIN_SERVICE_CONTACT_ADDRESS2 || null,
    city: process.env.DOMAIN_SERVICE_CONTACT_CITY || "",
    stateProvince: process.env.DOMAIN_SERVICE_CONTACT_STATE || "",
    postalCode: process.env.DOMAIN_SERVICE_CONTACT_POSTAL_CODE || "",
    countryCode: (
      process.env.DOMAIN_SERVICE_CONTACT_COUNTRY || ""
    ).toUpperCase(),
    phone: process.env.DOMAIN_SERVICE_CONTACT_PHONE || "",
    email: process.env.DOMAIN_SERVICE_CONTACT_EMAIL || "",
    registrantType: "ORGANIZATION" as const,
    confirmedAt: new Date(),
  };
  return validateRegistrantContact(c).complete ? c : null;
}
export function ownershipDescription(type: OwnershipType) {
  if (type === "WORKSPACE_OWNED")
    return "Workspace/customer is registrant; Quantum Reach manages DNS, SES, warmup, renewal, and billing as reseller/service provider.";
  if (type === "QUANTUM_REACH_MANAGED")
    return "Quantum Reach is registrant/owner; the customer may lease or use the domain under the service.";
  return "Shared pool is Quantum Reach-owned infrastructure and does not imply customer ownership.";
}
