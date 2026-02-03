//********************************************************************
//
// LocationProvider Component
//
// Provides location context to the entire application. Manages GPS
// location permissions, fetches current location, and syncs location
// to the backend. Waits for Cognito authentication before syncing
// to prevent 401 errors. Automatically fetches and syncs location
// when user logs in.
//
// Return Value
// ------------
// React.ReactElement    JSX element with LocationContext.Provider
//
// Value Parameters
// ----------------
// children    ReactNode    Child components to wrap with location context
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// location              LocationData        Current location state
// auth                  Auth                Cognito auth instance
// user                  User|null           Current authenticated user
// fresh                 LocationData|null   Fresh location from GPS
// status                PermissionStatus    Location permission status
// pos                   LocationObject      Current position from GPS
// coords                LocationData        Coordinates from position
// err                   Error               Error object if request fails
// unsub                 function            Unsubscribe function for auth listener
//
//*******************************************************************

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

import * as Location from "expo-location";
import { useAuth } from "./AuthContext";
import { apiPatch } from "../services/apiService";

interface LocationData {
  latitude: number | null;
  longitude: number | null;
}

interface LocationContextType {
  location: LocationData;

  getLocation: () => Promise<LocationData | null>;
  syncLocationToBackend: (lat: number, lng: number) => Promise<void>;
}

const LocationContext = createContext<LocationContextType>({
  location: { latitude: null, longitude: null },
  getLocation: async () => null,
  syncLocationToBackend: async () => {},
});

export const LocationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, idToken } = useAuth();
  const [location, setLocation] = useState<LocationData>({
    latitude: null,
    longitude: null,
  });
  const lastSyncRef = useRef<{ lat: number; lng: number } | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasSyncedOnLoginRef = useRef<string | null>(null);

  //********************************************************************
  //
  // syncLocationToBackend Function
  //
  // Syncs location coordinates to the backend via PATCH request.
  // Silently fails on error to prevent blocking the app.
  // Debounced to prevent rate limiting - only syncs if location changed
  // significantly or after a delay.
  //
  // Return Value
  // ------------
  // Promise<void>
  //
  // Value Parameters
  // ----------------
  // lat    number    Latitude coordinate
  // lng    number    Longitude coordinate
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // err    Error     Error object if request fails
  //
  //*******************************************************************
  const syncLocationToBackend = useCallback(async (lat: number, lng: number) => {
    // Skip if no token available
    if (!idToken) {
      return;
    }

    // Check if location changed significantly (more than ~100m)
    const lastSync = lastSyncRef.current;
    if (lastSync) {
      const latDiff = Math.abs(lat - lastSync.lat);
      const lngDiff = Math.abs(lng - lastSync.lng);
      // ~0.001 degrees ≈ 100m
      if (latDiff < 0.001 && lngDiff < 0.001) {
        return; // Location hasn't changed significantly
      }
    }

    // Clear any pending sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce: wait 2 seconds before syncing
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        await apiPatch("/profiles/update-location", { lat, lng }, idToken);
        lastSyncRef.current = { lat, lng };
      } catch (err) {
        console.error("Failed to sync location:", err);
      }
    }, 2000);
  }, [idToken]);

  //********************************************************************
  //
  // getLocation Function
  //
  // Requests location permissions and fetches current GPS coordinates.
  // Updates location state and returns coordinates. Returns null if
  // permissions are denied or an error occurs.
  //
  // Return Value
  // ------------
  // Promise<LocationData | null>    Location coordinates or null
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
  // status    PermissionStatus    Location permission status
  // pos       LocationObject      Current position from GPS
  // coords    LocationData        Coordinates from position
  // err       Error               Error object if request fails
  //
  //*******************************************************************
  const getLocation = useCallback(async (): Promise<LocationData | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return null;

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };

      setLocation(coords);
      return coords;
    } catch (err) {
      console.error("Location error:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!user?.uid || !idToken) return;

    // Only sync location once per user login (track by uid)
    // Subsequent location updates are handled by useLocation hook
    if (hasSyncedOnLoginRef.current === user.uid) {
      return; // Already synced for this user
    }

    const syncLocation = async () => {
      const fresh = await getLocation();
      if (fresh?.latitude && fresh.longitude) {
        await syncLocationToBackend(fresh.latitude, fresh.longitude);
        hasSyncedOnLoginRef.current = user.uid;
      }
    };

    syncLocation();
    
    // Cleanup timeout on unmount
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [user?.uid, idToken, getLocation, syncLocationToBackend]);

  return (
    <LocationContext.Provider
      value={{
        location,
        getLocation,
        syncLocationToBackend,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

//********************************************************************
//
// useLocationContext Hook
//
// Hook to access location context. Returns location data and functions
// to get location and sync to backend.
//
// Return Value
// ------------
// LocationContextType    Location context value
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
// None
//
//*******************************************************************
export const useLocationContext = () => useContext(LocationContext);
