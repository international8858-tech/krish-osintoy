// Catalog of all upstream OSINT services. Single source of truth.
export type ServiceDef = {
  key: string;       // path segment (e.g., "number")
  param: string;     // query param name (e.g., "num")
  label: string;
  example: string;
};

export const SERVICES: ServiceDef[] = [
  { key: "number",      param: "num",      label: "Phone Number Lookup",   example: "9876543210" },
  { key: "aadhar",      param: "num",      label: "Aadhaar Lookup",        example: "393933081942" },
  { key: "name",        param: "name",     label: "Name Search",           example: "abhiraaj" },
  { key: "adv",         param: "num",      label: "Advanced Phone",        example: "9876543210" },
  { key: "upi",         param: "upi",      label: "UPI Lookup",            example: "example@ybl" },
  { key: "ifsc",        param: "ifsc",     label: "IFSC Bank Lookup",      example: "SBIN0001234" },
  { key: "pan",         param: "pan",      label: "PAN Card",              example: "AXDPR2606K" },
  { key: "pincode",     param: "pin",      label: "Pincode Lookup",        example: "110001" },
  { key: "ip",          param: "ip",       label: "IP Address Lookup",     example: "8.8.8.8" },
  { key: "vehicle",     param: "vehicle",  label: "Vehicle Number",        example: "MH02FZ0555" },
  { key: "rc",          param: "owner",    label: "RC Owner Lookup",       example: "UP92P2111" },
  { key: "ff",          param: "uid",      label: "Free Fire UID",         example: "3143389983" },
  { key: "bgmi",        param: "uid",      label: "BGMI UID",              example: "5121439477" },
  { key: "insta",       param: "username", label: "Instagram",             example: "cristiano" },
  { key: "git",         param: "username", label: "GitHub",                example: "ftgamer2" },
  { key: "tg",          param: "info",     label: "Telegram Info",         example: "6858648491" },
  { key: "paytm",       param: "num",      label: "Paytm Lookup",          example: "9876543210" },
  { key: "adharfamily", param: "num",      label: "Aadhaar Family",        example: "984154610245" },
  { key: "tgidinfo",    param: "id",       label: "Telegram ID Info",      example: "7530266953" },
  { key: "snap",        param: "username", label: "Snapchat",              example: "priyapanchal272" },
  { key: "imei",        param: "imei",     label: "IMEI Lookup",           example: "357817383506298" },
  { key: "calltracer",  param: "num",      label: "Call Tracer",           example: "9876543210" },
  { key: "pk",          param: "num",      label: "Pakistan Phone",        example: "03331234567" },
];

export const SERVICE_MAP: Record<string, ServiceDef> = Object.fromEntries(
  SERVICES.map((s) => [s.key, s])
);
