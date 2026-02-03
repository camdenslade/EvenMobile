//********************************************************************
//
// NotificationsSetup Component
//
// Component that initializes push notifications inside the NavigationContainer
// context. This ensures the useNotifications hook has access to navigation
// when handling notification taps. Renders nothing (null).
//
// Return Value
// ------------
// null (renders nothing)
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

import { useNotifications } from '../hooks/useNotifications';

export default function NotificationsSetup() {
  useNotifications();
  return null;
}

