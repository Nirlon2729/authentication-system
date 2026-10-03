/**
 * Explainable, transparent risk scoring engine for authentication events.
 *
 * Scoring model:
 *   - Base score: 0
 *   - New unrecognized device: +25
 *   - New browser or operating system: +15
 *   - Unfamiliar IP address: +10
 *   - New approximate country: +25
 *   - Rapid geographic transition (impossible travel): +45
 *   - Recent failed login attempts:
 *       1-2 attempts: +15
 *       3-4 attempts: +30
 *       >= 5 attempts: +45
 *   - Recent password change (< 1h): +15
 *
 * Risk categories:
 *   - LOW: 0 - 29 (Standard login, familiar device, initial baseline)
 *   - MEDIUM: 30 - 59 (New device or unfamiliar location)
 *   - HIGH: 60 - 79 (Combination of new device, new location, and/or prior failures)
 *   - CRITICAL: >= 80 (Impossible travel, high-volume brute-force transition)
 */

function assessLoginRisk({
  isNewDevice = false,
  isFirstDevice = false,
  isNewBrowserOrOS = false,
  isUnfamiliarIP = false,
  isNewCountry = false,
  isImpossibleTravel = false,
  impossibleTravelReason = "",
  failedLoginsCount = 0,
  recentPasswordChange = false,
  isGoogleAuth = false,
} = {}) {
  let score = 0;
  const reasons = [];
  const contributingFactors = {};

  // First device ever seen (new account or clean baseline) is not treated as suspicious
  if (isFirstDevice) {
    return {
      riskScore: 5,
      riskLevel: "LOW",
      riskReasons: ["Initial account sign-in baseline established."],
      recommendedAction: "ALLOW",
      contributingFactors: { initialBaseline: 5 },
    };
  }

  // 1. Device and Browser signals
  if (isNewDevice) {
    score += 25;
    reasons.push("Sign-in from a new or previously unrecognized device.");
    contributingFactors.newDevice = 25;
  }

  if (isNewBrowserOrOS) {
    score += 15;
    reasons.push("Sign-in from an unfamiliar browser family or operating system.");
    contributingFactors.newBrowserOrOS = 15;
  }

  // 2. Network and Location signals
  if (isUnfamiliarIP) {
    score += 10;
    reasons.push("Sign-in from an unfamiliar IP address.");
    contributingFactors.unfamiliarIP = 10;
  }

  if (isNewCountry) {
    score += 25;
    reasons.push("Sign-in originating from a new country not previously seen for this account.");
    contributingFactors.newCountry = 25;
  }

  if (isImpossibleTravel) {
    score += 45;
    reasons.push(
      impossibleTravelReason ||
        "Rapid geographic transition detected (unrealistic physical travel velocity)."
    );
    contributingFactors.impossibleTravel = 45;
  }

  // 3. Prior authentication failures (brute-force / credential stuffing correlation)
  if (failedLoginsCount >= 5) {
    score += 45;
    reasons.push(`Preceded by ${failedLoginsCount} recent failed authentication attempts.`);
    contributingFactors.failedLogins = 45;
  } else if (failedLoginsCount >= 3) {
    score += 30;
    reasons.push(`Preceded by ${failedLoginsCount} recent failed authentication attempts.`);
    contributingFactors.failedLogins = 30;
  } else if (failedLoginsCount > 0) {
    score += 15;
    reasons.push(`Preceded by ${failedLoginsCount} failed login attempt.`);
    contributingFactors.failedLogins = 15;
  }

  // 4. Recent sensitive account changes
  if (recentPasswordChange) {
    score += 15;
    reasons.push("Sign-in shortly following a recent password modification or account recovery.");
    contributingFactors.recentPasswordChange = 15;
  }

  // Clamp score between 0 and 100
  const finalScore = Math.min(100, Math.max(0, score));

  // Determine category
  let riskLevel = "LOW";
  let recommendedAction = "ALLOW";

  if (finalScore >= 80) {
    riskLevel = "CRITICAL";
    recommendedAction = "RESTRICT";
  } else if (finalScore >= 60) {
    riskLevel = "HIGH";
    recommendedAction = "CHALLENGE";
  } else if (finalScore >= 30) {
    riskLevel = "MEDIUM";
    recommendedAction = "NOTIFY";
  } else {
    riskLevel = "LOW";
    recommendedAction = "ALLOW";
    if (reasons.length === 0) {
      reasons.push("Standard sign-in from recognized device and location.");
    }
  }

  return {
    riskScore: finalScore,
    riskLevel,
    riskReasons: reasons,
    recommendedAction,
    contributingFactors,
  };
}

module.exports = {
  assessLoginRisk,
};
