export type CustomerDetailsErrors = {
  fullName?: string;
  email?: string;
  whatsapp?: string;
};

type CustomerDetailsInput = {
  fullName: unknown;
  email: unknown;
  whatsapp: unknown;
};

type ValidCustomerDetails = {
  ok: true;
  fullName: string;
  email: string;
  whatsapp: string;
};

type InvalidCustomerDetails = {
  ok: false;
  errors: CustomerDetailsErrors;
};

const VALID_CALLING_CODES = new Set([
  "1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39",
  "40", "41", "43", "44", "45", "46", "47", "48", "49", "51", "52",
  "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64",
  "65", "66", "81", "82", "84", "86", "90", "91", "92", "93", "94",
  "95", "98", "211", "212", "213", "216", "218", "220", "221", "222",
  "223", "224", "225", "226", "227", "228", "229", "230", "231", "232",
  "233", "234", "235", "236", "237", "238", "239", "240", "241", "242",
  "243", "244", "245", "246", "248", "249", "250", "251", "252", "253",
  "254", "255", "256", "257", "258", "260", "261", "262", "263", "264",
  "265", "266", "267", "268", "269", "290", "291", "297", "298", "299",
  "350", "351", "352", "353", "354", "355", "356", "357", "358", "359",
  "370", "371", "372", "373", "374", "375", "376", "377", "378", "380",
  "381", "382", "383", "385", "386", "387", "389", "420", "421", "423",
  "500", "501", "502", "503", "504", "505", "506", "507", "508", "509",
  "590", "591", "592", "593", "594", "595", "596", "597", "598", "599",
  "670", "672", "673", "674", "675", "676", "677", "678", "679", "680",
  "681", "682", "683", "685", "686", "687", "688", "689", "690", "691",
  "692", "800", "808", "850", "852", "853", "855", "856", "870", "878",
  "880", "881", "882", "883", "886", "888", "960", "961", "962", "963",
  "964", "965", "966", "967", "968", "970", "971", "972", "973", "974",
  "975", "976", "977", "979", "992", "993", "994", "995", "996", "998",
]);

function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  const [localPart, domain, extra] = email.split("@");
  if (!localPart || !domain || extra !== undefined || localPart.length > 64) return false;
  if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) return false;
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i.test(localPart)) return false;

  const labels = domain.split(".");
  return labels.length >= 2 && labels.every((label) =>
    label.length > 0
    && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
  ) && /^[a-z]{2,63}$/i.test(labels[labels.length - 1]);
}

function normalizeWhatsAppNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\+?[\d\s().-]+$/.test(trimmed)) return null;

  let compact = trimmed.replace(/[\s().-]/g, "");
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;

  if (!compact.startsWith("+")) {
    if (!/^0[1-9]\d{8}$/.test(compact)) return null;
    compact = `+94${compact.slice(1)}`;
  }

  const digits = compact.slice(1);
  if (!/^\d{8,15}$/.test(digits)) return null;

  const callingCode = [...VALID_CALLING_CODES]
    .sort((left, right) => right.length - left.length)
    .find((code) => digits.startsWith(code));
  if (!callingCode) return null;

  const nationalNumber = digits.slice(callingCode.length);
  if (nationalNumber.length < 4 || /^0+$/.test(nationalNumber)) return null;
  if (callingCode === "94" && (nationalNumber.length !== 9 || nationalNumber.startsWith("0"))) return null;
  if (callingCode === "1" && (nationalNumber.length !== 10 || !/^[2-9]\d{9}$/.test(nationalNumber))) return null;
  if (callingCode === "44" && !/^[1-9]\d{9}$/.test(nationalNumber)) return null;

  return `+${digits}`;
}

export function validateCustomerDetails(input: CustomerDetailsInput): ValidCustomerDetails | InvalidCustomerDetails {
  const fullName = String(input.fullName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const rawWhatsApp = String(input.whatsapp ?? "").trim();
  const whatsapp = normalizeWhatsAppNumber(rawWhatsApp);
  const errors: CustomerDetailsErrors = {};

  if (!fullName) errors.fullName = "Please enter your full name.";
  if (!email) {
    errors.email = "Please enter your email address.";
  } else if (!isValidEmail(email)) {
    errors.email = "Please enter a valid email address.";
  }
  if (!rawWhatsApp) {
    errors.whatsapp = "Please enter your WhatsApp number.";
  } else if (!whatsapp) {
    errors.whatsapp = "Enter a valid WhatsApp number with a country code (for example, +94 77 123 4567).";
  }

  if (Object.keys(errors).length > 0 || !whatsapp) return { ok: false, errors };
  return { ok: true, fullName, email, whatsapp };
}

export function validateCustomerDetailsAndContinue(
  input: CustomerDetailsInput,
  onContinue: (details: ValidCustomerDetails) => void,
): ValidCustomerDetails | InvalidCustomerDetails {
  const result = validateCustomerDetails(input);
  if (result.ok) onContinue(result);
  return result;
}
