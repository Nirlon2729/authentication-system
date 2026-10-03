const https = require("https");
const http = require("http");

// In-memory cache for IP geolocation with 24-hour TTL
const geoCache = new Map();
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Checks if an IP is private, loopback, or reserved (bogon).
 */
function isPrivateIP(ip) {
  if (!ip || typeof ip !== "string") return true;
  const cleanIP = ip.replace(/^::ffff:/, "").trim();

  if (
    cleanIP === "127.0.0.1" ||
    cleanIP === "::1" ||
    cleanIP === "localhost" ||
    cleanIP === "0.0.0.0" ||
    cleanIP.startsWith("10.") ||
    cleanIP.startsWith("192.168.") ||
    cleanIP.startsWith("169.254.") ||
    cleanIP.startsWith("fc00:") ||
    cleanIP.startsWith("fe80:")
  ) {
    return true;
  }

  // 172.16.0.0 - 172.31.255.255
  if (cleanIP.startsWith("172.")) {
    const parts = cleanIP.split(".");
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
  }

  return false;
}

/**
 * Looks up approximate geolocation for an IP address.
 * Fails safely and quickly with a 1.5s timeout.
 */
async function lookupIPLocation(ip) {
  if (!ip || typeof ip !== "string") {
    return {
      country: "Unknown Country",
      region: "",
      city: "Unknown City",
      latitude: null,
      longitude: null,
      isPrivate: true,
      displayLocation: "Unknown Location",
    };
  }

  const cleanIP = ip.replace(/^::ffff:/, "").trim();

  // Test override support for unit tests
  if (global.__TEST_GEO_OVERRIDE__ && global.__TEST_GEO_OVERRIDE__[cleanIP]) {
    const override = global.__TEST_GEO_OVERRIDE__[cleanIP];
    return {
      country: override.country || "Unknown Country",
      region: override.region || "",
      city: override.city || "Unknown City",
      latitude: override.latitude || null,
      longitude: override.longitude || null,
      isPrivate: false,
      displayLocation: override.city && override.country ? `${override.city}, ${override.country}` : (override.country || "Unknown Location"),
    };
  }

  // Handle local / private network IPs
  if (isPrivateIP(cleanIP)) {
    return {
      country: "Local Network",
      region: "",
      city: "Localhost",
      latitude: null,
      longitude: null,
      isPrivate: true,
      displayLocation: "Local Network",
    };
  }

  // Check in-memory cache
  const cached = geoCache.get(cleanIP);
  if (cached && Date.now() - cached.cachedAt < GEO_CACHE_TTL) {
    return cached.data;
  }

  // In test environment without explicit lookup request, return simulated public location
  if (process.env.NODE_ENV === "test") {
    const testResult = {
      country: "United States",
      region: "California",
      city: "San Francisco",
      latitude: 37.7749,
      longitude: -122.4194,
      isPrivate: false,
      displayLocation: "San Francisco, United States",
    };
    return testResult;
  }

  // Fast HTTP lookup to ip-api with 1.5s timeout
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        geoCache.set(cleanIP, { data: result, cachedAt: Date.now() });
        resolve(result);
      }
    };

    const fallback = {
      country: "Unknown Country",
      region: "",
      city: "Unknown City",
      latitude: null,
      longitude: null,
      isPrivate: false,
      displayLocation: "Unknown Location",
    };

    const timer = setTimeout(() => {
      finish(fallback);
    }, 1500);

    try {
      const req = http.get(`http://ip-api.com/json/${encodeURIComponent(cleanIP)}?fields=status,country,regionName,city,lat,lon`, (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          clearTimeout(timer);
          try {
            const data = JSON.parse(raw);
            if (data && data.status === "success") {
              const country = data.country || "Unknown Country";
              const city = data.city || "Unknown City";
              const region = data.regionName || "";
              const displayLocation = city && country ? `${city}, ${country}` : country;
              finish({
                country,
                region,
                city,
                latitude: data.lat ?? null,
                longitude: data.lon ?? null,
                isPrivate: false,
                displayLocation,
              });
              return;
            }
          } catch (_e) {}
          finish(fallback);
        });
      });

      req.on("error", () => {
        clearTimeout(timer);
        finish(fallback);
      });
    } catch (_err) {
      clearTimeout(timer);
      finish(fallback);
    }
  });
}

/**
 * Calculates Haversine distance between two coordinates in kilometers.
 */
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 === null ||
    lon1 === null ||
    lat2 === null ||
    lon2 === null ||
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined
  ) {
    return 0;
  }

  const toRad = (angle) => (angle * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Analyzes whether movement between previous and current login indicates impossible travel.
 * Threshold: speed > 800 km/h with distance > 300 km.
 */
function checkImpossibleTravel(prevLocation, currentLocation, prevTime, currentTime) {
  if (!prevLocation || !currentLocation || !prevTime || !currentTime) {
    return { isImpossibleTravel: false, speedKmH: 0, distanceKm: 0 };
  }

  if (prevLocation.isPrivate || currentLocation.isPrivate) {
    return { isImpossibleTravel: false, speedKmH: 0, distanceKm: 0 };
  }

  if (prevLocation.latitude == null || currentLocation.latitude == null) {
    // If coordinates are missing, check if countries are completely different in under 30 minutes
    const timeDiffMs = Math.abs(new Date(currentTime).getTime() - new Date(prevTime).getTime());
    const isDifferentCountry =
      prevLocation.country &&
      currentLocation.country &&
      prevLocation.country !== "Unknown Country" &&
      currentLocation.country !== "Unknown Country" &&
      prevLocation.country !== currentLocation.country;

    if (isDifferentCountry && timeDiffMs < 30 * 60 * 1000) {
      return {
        isImpossibleTravel: true,
        speedKmH: 2000,
        distanceKm: 1500,
        reason: `Login from ${currentLocation.country} within ${Math.round(timeDiffMs / 60000)} minutes of login from ${prevLocation.country}`,
      };
    }
    return { isImpossibleTravel: false, speedKmH: 0, distanceKm: 0 };
  }

  const distanceKm = calculateHaversineDistanceKm(
    prevLocation.latitude,
    prevLocation.longitude,
    currentLocation.latitude,
    currentLocation.longitude
  );

  const timeDiffHours = Math.abs(new Date(currentTime).getTime() - new Date(prevTime).getTime()) / (1000 * 60 * 60);

  if (timeDiffHours <= 0) {
    if (distanceKm > 100) {
      return { isImpossibleTravel: true, speedKmH: 5000, distanceKm };
    }
    return { isImpossibleTravel: false, speedKmH: 0, distanceKm };
  }

  const speedKmH = distanceKm / timeDiffHours;

  // Typical jet cruising speed is ~800-900 km/h. If distance > 300km and speed > 800km/h, flag impossible travel.
  if (distanceKm > 300 && speedKmH > 800) {
    return {
      isImpossibleTravel: true,
      speedKmH: Math.round(speedKmH),
      distanceKm: Math.round(distanceKm),
      reason: `Traveled ${Math.round(distanceKm)} km at ${Math.round(speedKmH)} km/h in ${Math.round(timeDiffHours * 60)} minutes`,
    };
  }

  return { isImpossibleTravel: false, speedKmH: Math.round(speedKmH), distanceKm: Math.round(distanceKm) };
}

module.exports = {
  isPrivateIP,
  lookupIPLocation,
  calculateHaversineDistanceKm,
  checkImpossibleTravel,
};
