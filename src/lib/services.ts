// Catalog of all upstream OSINT services with full documentation metadata.
export type ServiceDef = {
  key: string;        // path segment used in /api/v1/<key>
  param: string;      // query param name
  paramDesc: string;  // human description of the param
  label: string;
  category: string;
  description: string;
  example: string;
  sampleResponse: unknown; // already sanitized (by=Krishna, channel=t.me/moneycomming)
  notes?: string;
};

const BY = "Krishna";
const CH = "https://t.me/moneycomming";

export const SERVICES: ServiceDef[] = [
  {
    key: "number", param: "num", paramDesc: "10-digit Indian mobile number",
    label: "Phone Number Lookup", category: "Phone Intelligence",
    description: "Returns owner name, address, alternate numbers, father's name, linked Aadhaar and email for an Indian mobile number.",
    example: "7307841587",
    sampleResponse: {
      success: true, number: "7307841587", total: 2,
      results: [{
        mobile: "7307841587", name: "Nemsingh",
        address: "j gram dabhaura simra post sarsava k tilhar Shahjahanpur Uttar Pradesh 242303",
        circle: "JIO UPE", alternate: "8542812624",
        father_name: "jayram", aadhar: "226010868980",
        email: "akaShguptu@gmail.com", truecaller_name: null,
      }],
      truecaller_name: null, cached: true, by: BY, channel: CH,
    },
  },
  {
    key: "aadhar", param: "num", paramDesc: "12-digit Aadhaar number",
    label: "Aadhaar Lookup", category: "Phone Intelligence",
    description: "Resolves an Aadhaar number to the registered name, age, gender, district, state, and linked phone.",
    example: "393933081942",
    sampleResponse: {
      success: true, aadhar: "393933081942", total: 1,
      results: [{
        name: "J Vinod", fathersName: "", phoneNumber: "9490160194",
        aadharNumber: "393933081942", age: "28", gender: "Male",
        address: "Hyderabad", district: "HYDERABAD", pincode: null,
        state: "TELANGANA", town: null,
      }], by: BY,
    },
  },
  {
    key: "name", param: "name", paramDesc: "Person's name (full or partial)",
    label: "Name Search", category: "Phone Intelligence",
    description: "Searches the database for people matching the given name and returns matches with phone, age, location.",
    example: "abhiraaj",
    sampleResponse: {
      success: true, name: "abhiraaj", total: 1,
      results: [{
        name: "ABHIRAAJ BALASAHEB GAWADE", phoneNumber: "9823796702",
        age: "6", gender: "Male", address: "CHAMDGAD",
        district: "KOLHAPUR", pincode: "416509", state: "MAHARASHTRA", town: "NAGANWADI",
      }], by: BY,
    },
  },
  {
    key: "adv", param: "num", paramDesc: "10-digit Indian mobile number",
    label: "Advanced Phone Lookup", category: "Phone Intelligence",
    description: "Deeper phone lookup with extended results from multiple sources. May take 15-30 seconds.",
    example: "9876543210",
    notes: "Response time can be 15-30s for this endpoint.",
    sampleResponse: {
      success: true, number: "9876543210", total: 17,
      results: [{
        aadharNumber: "527034357255", address: "MUMBAI", age: 24,
        district: "MUMBAI", gender: "MALE", mobile: "9876543210",
        name: "RAHUL SHARMA", pincode: "400001", state: "MAHARASHTRA",
      }], by: BY,
    },
  },
  {
    key: "upi", param: "upi", paramDesc: "UPI VPA (e.g. name@ybl)",
    label: "UPI Verify", category: "Financial",
    description: "Validates a UPI ID and returns the account holder name, bank, IFSC prefix and PSP.",
    example: "example@ybl",
    sampleResponse: {
      success: true, upi_id: "example@ybl", valid: true,
      account_name: "MURENDRA SARABU", bank: "Union Bank of India",
      ifsc: "UBIN", psp: "PhonePe", is_merchant: false, by: BY,
    },
  },
  {
    key: "ifsc", param: "ifsc", paramDesc: "IFSC code (e.g. SBIN0001234)",
    label: "IFSC Bank Lookup", category: "Financial",
    description: "Returns bank, branch, address, MICR and supported payment modes for an IFSC code.",
    example: "SBIN0001234",
    sampleResponse: {
      success: true, ifsc: "SBIN0001234", bank: "State Bank of India",
      bank_code: "SBIN", branch: "HAJIGANJ", address: "PATNA, BIHAR, PIN 800008",
      city: "PATNA", district: "PATNA", state: "BIHAR", micr: "800002019",
      payment_modes: { upi: true, imps: true, neft: true, rtgs: true }, by: BY,
    },
  },
  {
    key: "pan", param: "pan", paramDesc: "PAN number (e.g. AXDPR2606K)",
    label: "PAN to GST", category: "Financial",
    description: "Returns linked GSTINs for a PAN with status and state.",
    example: "AXDPR2606K",
    sampleResponse: {
      success: true, pan: "AXDPR2606K",
      result: { pan: "AXDPR2606K", total: 1, gstins: [{ gstin: "192500063179ES0", status: "Active", state: "WEST BENGAL" }] },
      by: BY,
    },
  },
  {
    key: "pincode", param: "pin", paramDesc: "6-digit PIN code",
    label: "Pincode Lookup", category: "Location",
    description: "Returns state, district, division, region and all post offices under a PIN code.",
    example: "110001",
    sampleResponse: {
      success: true, pincode: "110001", state: "Delhi", district: "Central Delhi",
      division: "New Delhi Central", region: "Delhi", country: "India",
      total_offices: 21,
      post_offices: [{ name: "Connaught Place", branch_type: "Sub Post Office", delivery_status: "Non-Delivery" }],
      by: BY,
    },
  },
  {
    key: "ip", param: "ip", paramDesc: "IPv4 or IPv6 address",
    label: "IP Address Lookup", category: "Location",
    description: "Returns geo, ASN, ISP, timezone and other metadata for an IP address.",
    example: "8.8.8.8",
    sampleResponse: {
      success: true, ip: "8.8.8.8", type: "IPv4", country: "United States",
      country_code: "US", region: "California", city: "Mountain View",
      postal: "94039", latitude: 37.3860517, longitude: -122.0838511,
      timezone: "America/Los_Angeles", asn: 15169, isp: "Google LLC", by: BY,
    },
  },
  {
    key: "vehicle", param: "vehicle", paramDesc: "Vehicle registration number (e.g. MH02FZ0555)",
    label: "Vehicle to Owner", category: "Vehicle",
    description: "Returns owner, model, fuel, insurance and registration details for a vehicle registration number.",
    example: "MH02FZ0555",
    notes: "Uses 'vehicle' param. Returns 'status':'success' instead of 'success':true.",
    sampleResponse: {
      status: "success",
      data: {
        rc_number: "MH02FZ0555", owner_name: "SHAH RUKH KHAN",
        maker_description: "ROLLS-ROYCE MOTOR CARS", maker_model: "BLACK BADGE CULLINAN",
        fuel_type: "PETROL", color: "ARCTIC WHITE",
        insurance_company: "ICICI Lombard General Insurance Co. Ltd.",
        insurance_upto: "2026-03-16", registration_date: "2023-04-12",
        registered_at: "MUMBAI (WEST), Maharashtra", rc_status: "ACTIVE", vehicle_category: "LMV",
      }, by: BY, latency_ms: 3505,
    },
  },
  {
    key: "rc", param: "owner", paramDesc: "RC number (e.g. UP92P2111)",
    label: "RC to Detailed Info", category: "Vehicle",
    description: "Returns full RC details: ownership, vehicle, insurance, important dates and other info.",
    example: "UP92P2111",
    sampleResponse: {
      success: true, rc: "UP92P2111",
      result: {
        "Ownership Details": { "Owner Name": "SANJU SOLANKI", "Registration Number": "UP92P2111", "Registered RTO": "Orai, Uttar Pradesh" },
        "Vehicle Details": { "Maker Model": "HF DELUXE", "Fuel Type": "PETROL", "Chassis Number": "MBLHA11EWD9FXXXXX" },
        "Insurance Information": { "Insurance Expiry": "15-Sep-2021", "Insurance Company": "GoDigit General Insurance Ltd." },
      }, by: BY,
    },
  },
  {
    key: "ff", param: "uid", paramDesc: "Free Fire player UID",
    label: "Free Fire", category: "Gaming",
    description: "Returns Free Fire player profile: level, region, account created, last login, ban status.",
    example: "3143389983",
    sampleResponse: {
      success: true, uid: "3143389983",
      info: {
        "Account Created": "May 13, 2021 at 04:46:26", "Experience (XP)": "2138913",
        "Level": "67", "Likes": "11431", "Nickname": "BRONX", "Region": "IND",
      }, ban_status: "BANNED", by: BY,
    },
  },
  {
    key: "bgmi", param: "uid", paramDesc: "BGMI player UID",
    label: "BGMI", category: "Gaming",
    description: "Returns BGMI player username and region for a UID.",
    example: "5121439477",
    sampleResponse: { success: true, uid: "5121439477", game: "BGMI", region: "IND", username: "Kuiuraut", by: BY },
  },
  {
    key: "insta", param: "username", paramDesc: "Instagram username (no @)",
    label: "Instagram", category: "Social",
    description: "Returns Instagram profile data plus any linked OSINT records (email, phone, address).",
    example: "cristiano",
    sampleResponse: {
      success: true, username: "cristiano",
      profile: {
        id: "173560420", username: "cristiano", name: "Cristiano Ronaldo",
        verified: true, private: false, followers: 672571267, following: 630, posts: 4025,
      },
      osint: { available: true, records: [{ id: "173560420", username: "cristiano", name: "Cristiano Ronaldo" }] },
      by: BY,
    },
  },
  {
    key: "git", param: "username", paramDesc: "GitHub username",
    label: "GitHub", category: "Social",
    description: "Returns GitHub profile metadata for a username.",
    example: "ftgamer2",
    sampleResponse: {
      success: true, username: "ftgamer2", name: "FTGAMERV2",
      bio: "Teen dev cooking cool stuff with Python and Java",
      profile_url: "https://github.com/ftgamer2", public_repos: 6, followers: 1, by: BY,
    },
  },
  {
    key: "tg", param: "info", paramDesc: "Telegram @username or numeric user ID",
    label: "Telegram Info", category: "Social",
    description: "Resolves a Telegram username or user ID to the linked phone number and country.",
    example: "6858648491",
    sampleResponse: {
      success: true, info: "6858648491", number: "9627507420",
      country: "India", country_code: "+91", by: BY,
    },
  },
  {
    key: "paytm", param: "num", paramDesc: "10-digit mobile number",
    label: "Paytm Info", category: "Social",
    description: "Returns Paytm account name and UPI for a mobile number.",
    example: "9876543210",
    sampleResponse: { success: true, number: "9876543210", name: "Rahul Sharma", upi: "9876543210@paytm", by: BY },
  },
  {
    key: "adharfamily", param: "num", paramDesc: "12-digit Aadhaar number",
    label: "Aadhaar Family", category: "OSINT",
    description: "Returns ration card family details for an Aadhaar number: members, scheme, monthly summary.",
    example: "984154610245",
    sampleResponse: {
      success: true, ration_card_id: "202001643745",
      details: {
        card_info: { "Card Type": "PHH", District: "DHANBAD", State: "JHARKHAND", Scheme: "NFSA" },
        members: [{ member_name: "Shakuntala Devi", gender: "F", relationship: "SELF", uid_masked: "XXXX-XXXX-5129" }],
        monthly_summary: [{ month: "MARCH-2026", member_count: "6" }],
      }, by: BY,
    },
  },
  {
    key: "tgidinfo", param: "id", paramDesc: "Telegram numeric user ID",
    label: "Telegram ID Info", category: "OSINT",
    description: "Deep Telegram lookup: basic info, status, activity stats and linked phone.",
    example: "7530266953",
    sampleResponse: {
      success: true, id: "7530266953",
      basic_info: { ID: 7530266953, FIRST_NAME: "Aditya", USERNAMES_COUNT: 3, NAMES_COUNT: 6 },
      status_info: { IS_BOT: false, IS_ACTIVE: true },
      activity_info: { TOTAL_MSG_COUNT: 1940, TOTAL_GROUPS: 47 },
      number_info: { NUMBER: "9934846958", COUNTRY_CODE: "+91", COUNTRY: "India" },
      by: BY,
    },
  },
  {
    key: "snap", param: "username", paramDesc: "Snapchat username",
    label: "Snapchat", category: "OSINT",
    description: "Returns Snapchat profile info: existence, stories, subscribers, profile and snapcode URLs.",
    example: "priyapanchal272",
    sampleResponse: {
      success: true,
      data: {
        username: "priyapanchal272", description: "Priya Panchal | 128.6k Subscribers | Noida, India",
        exists: true, has_stories: true, is_verified: false, subscriber_count: "128.6k",
        profile_url: "https://www.snapchat.com/add/priyapanchal272",
      }, by: BY,
    },
  },
  {
    key: "imei", param: "imei", paramDesc: "14-17 digit IMEI number",
    label: "IMEI Lookup", category: "OSINT",
    description: "Returns device brand, model, specs and photo for an IMEI.",
    example: "357817383506298",
    sampleResponse: {
      success: true, imei: "357817383506298", status: "Done",
      device: { brand: "APPLE", model: "iPhone 17 Pro", imei: "357817383506298" },
      specs: { "Basic Info": { "Release Year": "2025", Chipset: "Apple A19 Pro" } },
      by: BY,
    },
  },
  {
    key: "calltracer", param: "num", paramDesc: "10-digit mobile number",
    label: "Call Tracer", category: "OSINT",
    description: "Returns SIM card carrier, state, language and helpline for a mobile number.",
    example: "9876543210",
    sampleResponse: {
      success: true, number: "9876543210",
      data: {
        Number: "+91-9876543210", "SIM card": "BSNL (Bharat Sanchar Nigam Limited)",
        "Mobile State": "Punjab", Language: "Punjabi", Country: "India", Helpline: "1800-180-1503",
      }, by: BY,
    },
  },
  {
    key: "pk", param: "num", paramDesc: "Pakistani mobile number",
    label: "Pakistan Number", category: "Pakistan",
    description: "Returns name, CNIC and address records linked to a Pakistani mobile number.",
    example: "03331234567",
    sampleResponse: {
      success: true, number: "03331234567", total: 2,
      results: [
        { name: "ASIM ALI", number: "3331234567", cnic: "3430125586549", address: "KARACHI, Sindh" },
        { name: "MUHAMMAD SHAHID", number: "3331234567", cnic: "3430313493131", address: "USMANABAD LANDHI KARACHI, Sindh" },
      ], by: BY,
    },
  },
];

export const SERVICE_MAP: Record<string, ServiceDef> = Object.fromEntries(
  SERVICES.map((s) => [s.key, s])
);

export const CATEGORIES: string[] = Array.from(new Set(SERVICES.map((s) => s.category)));
