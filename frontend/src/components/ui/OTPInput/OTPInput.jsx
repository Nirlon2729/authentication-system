import { useEffect, useRef } from "react";
import "./OTPInput.css";

const OTPInput = ({ value, onChange }) => {
  const inputRefs = useRef([]);
useEffect(() => {
  inputRefs.current[0]?.focus();
}, []);

  const otp = Array.from(
  { length: 6 },
  (_, index) => value[index] || ""
);

  const handleChange = (index, e) => {
    const val = e.target.value.replace(/\D/g, "");

    if (!val) {
      const newOTP = [...otp];
      newOTP[index] = "";
      onChange({
        target: {
          value: newOTP.join(""),
        },
      });
      return;
    }

    const digit = val.slice(-1);

    const newOTP = [...otp];
    newOTP[index] = digit;

    onChange({
      target: {
        value: newOTP.join(""),
      },
    });

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (
      e.key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pasted) return;

    onChange({
      target: {
        value: pasted,
      },
    });

    const nextIndex = Math.min(
      pasted.length,
      5
    );

    inputRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="otp-container">
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) =>
            (inputRefs.current[index] = el)
          }
          className="otp-box"
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) =>
            handleChange(index, e)
          }
          onKeyDown={(e) =>
            handleKeyDown(index, e)
          }
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
};

export default OTPInput;