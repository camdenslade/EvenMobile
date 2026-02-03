//********************************************************************
//
// index.ts — App Entry Point
//
// Application entry point for the Even Dating mobile app. This is the
// true entry file that Expo loads first. Ensures react-native-gesture-handler
// is initialized before any navigation logic, enables native screens for
// better performance, and registers the root App component with Expo.
//
// IMPORTANT: react-native-gesture-handler must be imported first before
// any navigation logic. Failing to do so can cause crashes, swipe/gesture
// components not responding, and navigation gesture issues.
//
// Return Value
// ------------
// None (side effects only)
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

import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';

// Enable native screens for better performance
enableScreens(true);

import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import App from './App';

// Defensive: alias any "auth" app key to our App before any runApplication calls.
const originalRunApplication = AppRegistry.runApplication;
AppRegistry.runApplication = (appKey, params) => {
  if (appKey === 'auth') {
    AppRegistry.registerComponent('auth', () => App);
  }
  return originalRunApplication(appKey, params);
};

// Register the main App component with Expo
registerRootComponent(App);
// Some dev/build pipelines may look for an "auth" app key; register it as well to avoid
// runtime "Component auth has not been registered yet" errors if the app key diverges.
AppRegistry.registerComponent('auth', () => App);
