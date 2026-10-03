import { useEffect, useRef } from "react";
import "./OTPInput.css";

/**
 * Extracts a normalized 6-character string from various value prop formats:
 * - String: "123456"
 * - Number: 123456
 * - Event-like: { target: { value: "123456" } }
 * - Null / undefined: ""
 */
const normalizeValue = (val) => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.replace(/\D/g, "").slice(0, 6);
  if (typeof val === "number") return String(val).replace(/\D/g, "").slice(0, 6);
  if (typeof val === "object") {
    const raw = val.target?.value ?? val.value ?? "";
    return String(raw).replace(/\D/g, "").slice(0, 6);
  }
  return "";
};

const OTPInput = ({
  value = "",
  onChange,
  autoFocus = true,
  numInputs = 6,
}) => {
  const inputRefs = useRef([]);
  const hasFocusedOnMount = useRef(false);

  // Safely normalize the incoming value prop without mutating
  const safeStr = normalizeValue(value);

  // Construct controlled digit array
  const digits = Array.from({ length: numInputs }, (_, i) => safeStr[i] || "");

  // Auto-focus only once on initial mount if requested
  useEffect(() => {
    if (autoFocus && !hasFocusedOnMount.current) {
      inputRefs.current[0]?.focus();
      hasFocusedOnMount.current = true;
    }
  }, [autoFocus]);

  const triggerChange = (newStr) => {
    if (typeof onChange !== "function") return;
    try {
      onChange(newStr);
    } catch (err) {
      // Gracefully handle parent components expecting an event object (e.target.value)
      if (err instanceof TypeError) {
        onChange({
          target: { value: newStr, name: "otp" },
          currentTarget: { value: newStr },
        });
      } else {
        throw err;
      }
    }
  };

  const updateOtpAt = (index, newDigit) => {
    const updated = [...digits];
    updated[index] = newDigit;
    const combined = updated.join("");
    triggerChange(combined);
    return combined;
  };

  const handleChange = (index, e) => {
    const rawVal = e.target.value;
    const cleanDigits = rawVal.replace(/\D/g, "");

    // Case 1: Cleared or empty
    if (!cleanDigits) {
      updateOtpAt(index, "");
      return;
    }

    // Case 2: Multi-digit input (e.g., SMS autofill or fast mobile keyboard paste)
    if (cleanDigits.length > 1) {
      const pasteDigits = cleanDigits.slice(0, numInputs);
      const updated = [...digits];
      
      // If full length or pasted at 0, fill from start; otherwise fill from current index
      const startIdx = cleanDigits.length >= numInputs ? 0 : index;
      for (let i = 0; i < pasteDigits.length; i++) {
        if (startIdx + i < numInputs) {
          updated[startIdx + i] = pasteDigits[i];
        }
      }
      
      const combined = updated.join("");
      triggerChange(combined);

      const focusTarget = Math.min(startIdx + pasteDigits.length, numInputs - 1);
      inputRefs.current[focusTarget]?.focus();
      return;
    }

    // Case 3: Single digit entered
    const singleDigit = cleanDigits.slice(-1);
    updateOtpAt(index, singleDigit);

    // Auto-advance focus to next empty or next box
    if (index < numInputs - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!digits[index]) {
        // If current box is already empty, move to previous box and clear it
        if (index > 0) {
          e.preventDefault();
          updateOtpAt(index - 1, "");
          inputRefs.current[index - 1]?.focus();
        }
      } else {
        // Current box has a digit: clear it
        e.preventDefault();
        updateOtpAt(index, "");
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (index < numInputs - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text/plain");
    const cleanDigits = pastedText.replace(/\D/g, "").slice(0, numInputs);

    if (!cleanDigits) return;

    triggerChange(cleanDigits);

    const nextIndex = Math.min(cleanDigits.length, numInputs - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="otp-container" role="group" aria-label="6-digit verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          className="otp-box"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={index === 0 ? 6 : 1}
          value={digit}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          aria-label={`Digit ${index + 1} of ${numInputs}`}
        />
      ))}
    </div>
  );
};

export default OTPInput;