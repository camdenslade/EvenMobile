//********************************************************************
//
// useLocation Hook
//
// This React hook provides access to the user's location from
// LocationProvider context. Exposes location data and a function to
// ensure location is fetched and synced to the backend.
//
// Return Value
// ------------
// Object containing:
//   location        Object            Location object with latitude/longitude
//   requireLocation  () => Promise     Function to ensure location is available
//
// Value Parameters
// ----------------
// None (React hook)
//
// Reference Parameters
// --------------------
// None (React hook)
//
// Local Variables
// ---------------
// location              Object            Location from context
// getLocation           Function          Function to fetch GPS location
// syncLocationToBackend Function          Function to sync location to backend
// hasLoc                boolean           Whether location exists
// fresh                 Object|null       Fresh location from GPS
//
//*******************************************************************

import { useCallback } from "react";
import { useLocationContext } from "../context/LocationProvider";

export const useLocation = () => {
  const { location, getLocation, syncLocationToBackend } = useLocationContext();

  //********************************************************************
  //
  // requireLocation Function
  //
  // Ensures location exists by requesting GPS permission and fetching
  // coordinates if needed. Syncs location to backend via PATCH
  // /profiles/update-location if location changed or doesn't exist.
  // Returns current location snapshot after attempting to update.
  //
  // Return Value
  // ------------
  // Promise<Object>    Location object with latitude/longitude
  //
  // Value Parameters
  // ----------------
  // None
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // hasLoc    boolean         Whether location exists and is valid
  // fresh     Object|null     Fresh location from GPS fetch
  //
  //*******************************************************************
  const requireLocation = useCallback(async () => {
    const hasLoc =
      location.latitude !== null &&
      location.longitude !== null &&
      !isNaN(location.latitude) &&
      !isNaN(location.longitude);

    if (!hasLoc) {
      const fresh = await getLocation();

      if (!fresh?.latitude || !fresh?.longitude) return location;

      // Only sync if location is significantly different (debounced in LocationProvider)
      await syncLocationToBackend(fresh.latitude, fresh.longitude);
      return fresh;
    }

    return location;
  }, [location, getLocation, syncLocationToBackend]);

  return {
    location,
    requireLocation,
  };
};
