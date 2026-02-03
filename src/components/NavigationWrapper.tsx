//********************************************************************
//
// NavigationWrapper Component
//
// Wrapper component that renders BottomNavBar and BottomButtons outside
// the Stack Navigator to exclude them from fade animations. Tracks
// current route name and conditionally displays navigation elements.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing navigation wrapper
//
// Value Parameters
// ----------------
// children    React.ReactNode    Navigation stack content
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// currentRoute    string|undefined    Current active route name
// state           any                 Navigation state object
// route           any                 Current route object
// routeName       string|undefined    Active route name passed to content
// activeTab       string|null         Active tab value for nav bar
// shouldShowNavBar boolean            Whether to show bottom nav bar
// shouldShowBottomButtons boolean     Whether to show bottom buttons
//
//*******************************************************************

import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { BottomNavBar } from './BottomNavBar';
import { BottomButtons } from './BottomButtons';
import { useBottomButtons } from '../context/BottomButtonsContext';
import NotificationsSetup from './NotificationsSetup';

interface NavigationWrapperProps {
  children: React.ReactNode;
}

//********************************************************************
//
// getActiveRouteName Function
//
// Recursively extracts the active route name from navigation state.
// Handles nested navigators by traversing the state tree.
//
// Return Value
// ------------
// string|undefined    Active route name or undefined if no state
//
// Value Parameters
// ----------------
// state    any    Navigation state object
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// route    any    Current route from state
//
//*******************************************************************
function getActiveRouteName(state: any): string | undefined {
  if (!state) return undefined;
  const route = state.routes[state.index];
  if (route?.state) {
    return getActiveRouteName(route.state);
  }
  return route?.name;
}

//********************************************************************
//
// NavigationContentWithRoute Component
//
// Component that receives route name as prop and renders navigation
// UI elements (BottomNavBar and BottomButtons) conditionally based
// on the active route.
//
// Return Value
// ------------
// React.ReactElement    JSX element with navigation elements
//
// Value Parameters
// ----------------
// children    React.ReactNode    Navigation stack content
// routeName   string|undefined   Active route name
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// navigation         any                 Navigation object
// buttonsState       Object|null         Bottom buttons state from context
// routeMap           Object              Map of route names to tab values
// activeTab          string|null         Active tab value
// shouldShowNavBar   boolean            Whether to show nav bar
// shouldShowBottomButtons boolean        Whether to show bottom buttons
//
//*******************************************************************
function NavigationContentWithRoute({ 
  children, 
  routeName 
}: { 
  children: React.ReactNode;
  routeName?: string;
}) {
  const navigation = useNavigation();
  const { buttonsState } = useBottomButtons();

  const getActiveTab = (): 'swipe' | 'matches' | 'messages' | 'profile' | null => {
    if (!routeName) return null;
    
    const routeMap: { [key: string]: 'swipe' | 'matches' | 'messages' | 'profile' } = {
      'Swipe': 'swipe',
      'Matches': 'matches',
      'Messages': 'messages',
      'Profile': 'profile',
    };
    
    return routeMap[routeName] || null;
  };

  const activeTab = getActiveTab();
  const shouldShowNavBar = activeTab !== null;
  const shouldShowBottomButtons = routeName === 'Swipe' && buttonsState !== null;

  return (
    <>
      <View style={styles.container}>
        {children}
      </View>
      {shouldShowBottomButtons && buttonsState && (
        <BottomButtons
          disabled={buttonsState.disabled}
          onUndo={buttonsState.onUndo}
          onLike={buttonsState.onLike}
          onMessage={buttonsState.onMessage}
          undoTokens={buttonsState.undoTokens}
          messageTokens={buttonsState.messageTokens}
        />
      )}
      {shouldShowNavBar && (
        <BottomNavBar 
          navigation={navigation as any} 
          active={activeTab!} 
        />
      )}
    </>
  );
}

export default function NavigationWrapper({ children }: NavigationWrapperProps) {
  const [currentRoute, setCurrentRoute] = useState<string | undefined>(undefined);

  //********************************************************************
  //
  // handleStateChange Function
  //
  // Callback for navigation state changes. Extracts active route name
  // and updates current route state.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // state    any    Navigation state object
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // routeName    string|undefined    Active route name from state
  //
  //*******************************************************************
  const handleStateChange = useCallback((state: any) => {
    if (state) {
      const routeName = getActiveRouteName(state);
      setCurrentRoute(routeName);
    }
  }, []);

  return (
    <NavigationContainer onStateChange={handleStateChange}>
      <NotificationsSetup />
      <NavigationContentWithRoute routeName={currentRoute}>
        {children}
      </NavigationContentWithRoute>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'visible',
  },
});
