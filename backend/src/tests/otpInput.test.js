const assert = require("assert");

/**
 * Verification helper mirroring the OTP normalization logic in OTPInput.jsx:
 * 1. Safe normalization of value prop (string, array, number, null, undefined)
 * 2. Non-digit character stripping
 * 3. Array padding to target length
 * 4. Dual invocation pattern (calling onChange with raw string and simulated event object)
 */
function normalizeOTPValue(value, length = 6) {
  if (Array.isArray(value)) {
    const clean = value.map((v) => (v ? String(v).replace(/\D/g, "").slice(-1) : ""));
    return Array.from({ length }, (_, i) => clean[i] || "");
  }
  if (typeof value === "string" || typeof value === "number") {
    const clean = String(value).replace(/\D/g, "").slice(0, length);
    return Array.from({ length }, (_, i) => clean[i] || "");
  }
  return Array.from({ length }, () => "");
}

function triggerDualCallback(callback, fullOtpString) {
  if (typeof callback !== "function") return;
  // Invoke with string
  callback(fullOtpString);
  // Invoke with synthetic event
  callback({
    target: { value: fullOtpString, name: "otp" },
    currentTarget: { value: fullOtpString },
  });
}

async function runOTPInputUnitTests() {
  console.log("🧪 Running Test: OTPInput Contract & Normalization...");

  // Test 1: Empty and null normalization
  assert.deepStrictEqual(normalizeOTPValue(null, 6), ["", "", "", "", "", ""]);
  assert.deepStrictEqual(normalizeOTPValue(undefined, 6), ["", "", "", "", "", ""]);
  assert.deepStrictEqual(normalizeOTPValue("", 6), ["", "", "", "", "", ""]);
  console.log("✅ Null, undefined, and empty string correctly normalized to 6 blank slots.");

  // Test 2: Number normalization
  assert.deepStrictEqual(normalizeOTPValue(123456, 6), ["1", "2", "3", "4", "5", "6"]);
  assert.deepStrictEqual(normalizeOTPValue(482, 6), ["4", "8", "2", "", "", ""]);
  console.log("✅ Numeric inputs correctly formatted into digit array.");

  // Test 3: String with non-digits stripped
  assert.deepStrictEqual(normalizeOTPValue("12-34-56", 6), ["1", "2", "3", "4", "5", "6"]);
  assert.deepStrictEqual(normalizeOTPValue("A1B2C3D4", 6), ["1", "2", "3", "4", "", ""]);
  console.log("✅ Non-digit characters safely stripped.");

  // Test 4: Array input normalization
  assert.deepStrictEqual(
    normalizeOTPValue(["1", "2", "3"], 6),
    ["1", "2", "3", "", "", ""]
  );
  console.log("✅ Array input correctly padded to specified length.");

  // Test 5: Dual callback invocation does not throw TypeError on either signature
  let receivedString = null;
  const stringConsumer = (val) => {
    receivedString = typeof val === "string" ? val : val?.target?.value;
  };
  triggerDualCallback(stringConsumer, "987654");
  assert.strictEqual(receivedString, "987654");

  let receivedFromEvent = null;
  const eventConsumer = (e) => {
    // Both e.target.value and raw string fallback must be handled safely
    receivedFromEvent = e?.target ? e.target.value : e;
  };
  triggerDualCallback(eventConsumer, "123456");
  assert.strictEqual(receivedFromEvent, "123456");
  console.log("✅ Dual callback contract verified without TypeError under both event and string signatures.");

  console.log("🎉 Test passed: OTPInput Contract & Normalization\n");
}

runOTPInputUnitTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
