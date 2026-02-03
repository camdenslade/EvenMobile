//********************************************************************
//
// useUserProfile Hook
//
// This React hook fetches and manages the authenticated user's profile
// from the backend. Loads profile on mount and provides a refresh
// function. Implements debouncing to prevent rapid successive API calls.
//
// Return Value
// ------------
// Object containing:
//   profile        UserProfile|null    Fetched user profile or null
//   loading        boolean             Loading state indicator
//   error          string|null         Error message if fetch failed
//   refreshProfile () => Promise       Function to manually refresh profile
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
// profile           UserProfile|null    Local state for user profile
// loading           boolean             Loading state
// error             string|null         Error message state
// fetchingRef       boolean             Flag to prevent concurrent fetches (ref)
// lastFetchTimeRef  number              Timestamp of last fetch (ref)
// data              UserProfile|null    Response from API
// err               Error               Error object if fetch fails
//
//*******************************************************************

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiGet } from '../services/apiService';
import type { UserProfile } from '../types/user';

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);

  //********************************************************************
  //
  // fetchProfile Function
  //
  // Fetches the user's profile from the /me endpoint. Implements
  // debouncing to prevent rapid successive calls (max once per 1000ms).
  // Updates local state with profile data or error message.
  //
  // Return Value
  // ------------
  // Promise<void>
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
  // now     number              Current timestamp in milliseconds
  // data    UserProfile|null    Response from API
  // err     Error               Error object if fetch fails
  //
  //*******************************************************************
  const fetchProfile = useCallback(async () => {
    const now = Date.now();
    if (fetchingRef.current || (now - lastFetchTimeRef.current < 1000)) {
      return;
    }

    fetchingRef.current = true;
    lastFetchTimeRef.current = now;
    setLoading(true);
    setError(null);

    try {
      const data = await apiGet<UserProfile>('/me');

      if (!data) {
        setError('Failed to load profile');
        setLoading(false);
        return;
      }

      setProfile(data);
      setLoading(false);
    } catch (err) {
      console.log('Profile fetch error:', err);
      setError('Failed to load profile');
      setLoading(false);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refreshProfile: fetchProfile,
  };
}
