//********************************************************************
//
// BottomNavBar Component
//
// Renders a fixed bottom navigation bar with four tabs: Swipe, Matches,
// Messages, and Profile. Icons are tinted white when active, gray otherwise.
// Implements debouncing to prevent rapid navigation taps.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the navigation bar
//
// Value Parameters
// ----------------
// navigation    BottomTabNavigationProp    Navigation object from React Navigation
// active        string                      Currently active tab name
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// navigatingRef      Set<string>           Set of screens currently navigating (ref)
// lastNavigateRef    Object                 Timestamps of last navigation per screen (ref)
// now                number                 Current timestamp in milliseconds
// lastNav            number                 Timestamp of last navigation for screen
// error              Error                  Navigation error object
//
//*******************************************************************

import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import { useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppImage } from './AppImage';

type TabName = 'Swipe' | 'Matches' | 'Messages' | 'Profile';

interface Props {
  navigation: BottomTabNavigationProp<any>;
  active: 'swipe' | 'matches' | 'messages' | 'profile';
}

export function BottomNavBar({ navigation, active }: Props) {
  const navigatingRef = useRef<Set<string>>(new Set());
  const lastNavigateRef = useRef<{ [key: string]: number }>({});
  const insets = useSafeAreaInsets();

  //********************************************************************
  //
  // handleNavigate Function
  //
  // Handles navigation to a screen with debouncing. Prevents navigation
  // if already on target screen, if within 100ms cooldown, or if already
  // navigating. Clears navigation lock after 300ms.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // screenName    TabName    Screen name to navigate to
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // now         number    Current timestamp in milliseconds
  // lastNav     number    Timestamp of last navigation for screen
  // error       Error     Navigation error object
  //
  //*******************************************************************
  const handleNavigate = useCallback((screenName: TabName) => {
    if (active === screenName.toLowerCase()) return;
    
    const now = Date.now();
    const lastNav = lastNavigateRef.current[screenName] || 0;
    if (now - lastNav < 100) return;

    if (navigatingRef.current.has(screenName)) return;
    
    navigatingRef.current.add(screenName);
    lastNavigateRef.current[screenName] = now;

    try {
      navigation.navigate(screenName);
    } catch (error) {
    }

    setTimeout(() => {
      navigatingRef.current.delete(screenName);
    }, 300);
  }, [navigation, active]);

  const bottomPadding = Platform.OS === 'ios' ? 34 : Math.max(insets.bottom, 20);

  return (
    <View 
      style={[styles.nav, { paddingBottom: bottomPadding }]}
      accessible={false}
      importantForAccessibility="no"
    >
      <TouchableOpacity
        onPress={() => handleNavigate('Swipe')}
        style={styles.btn}
        activeOpacity={0.5}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        disabled={active === 'swipe'}
        accessible={true}
        accessibilityLabel={active === 'swipe' ? 'Swipe, current tab' : 'Navigate to Swipe'}
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'swipe', disabled: active === 'swipe' }}
        accessibilityHint="Opens the swipe screen to browse profiles"
      >
        <AppImage
          source={require('../../assets/images/Even-App-Logos/TransparentBG/EE-SolidWhite.png')}
          style={[
            styles.iconImg,
            active === 'swipe' && styles.activeImg,
          ]}
          contentFit="contain"
          accessibilityRole="none"
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleNavigate('Matches')}
        style={styles.btn}
        activeOpacity={0.5}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        disabled={active === 'matches'}
        accessible={true}
        accessibilityLabel={active === 'matches' ? 'Matches, current tab' : 'Navigate to Matches'}
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'matches', disabled: active === 'matches' }}
        accessibilityHint="Opens your matches screen"
      >
        <AppImage
          source={require('../../assets/icons/match.png')}
          style={[
            styles.iconImg,
            active === 'matches' && styles.activeImg,
          ]}
          contentFit="contain"
          accessibilityRole="none"
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleNavigate('Messages')}
        style={styles.btn}
        activeOpacity={0.5}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        disabled={active === 'messages'}
        accessible={true}
        accessibilityLabel={active === 'messages' ? 'Messages, current tab' : 'Navigate to Messages'}
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'messages', disabled: active === 'messages' }}
        accessibilityHint="Opens your messages screen"
      >
        <AppImage
          source={require('../../assets/icons/message.png')}
          style={[
            styles.iconImg,
            active === 'messages' && styles.activeImg,
          ]}
          contentFit="contain"
          accessibilityRole="none"
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleNavigate('Profile')}
        style={styles.btn}
        activeOpacity={0.5}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        disabled={active === 'profile'}
        accessible={true}
        accessibilityLabel={active === 'profile' ? 'Profile, current tab' : 'Navigate to Profile'}
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'profile', disabled: active === 'profile' }}
        accessibilityHint="Opens your profile screen"
      >
        <AppImage
          source={require('../../assets/icons/profile.png')}
          style={[
            styles.iconImg,
            active === 'profile' && styles.activeImg,
          ]}
          contentFit="contain"
          accessibilityRole="none"
        />
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: Platform.OS === 'android' ? 8 : 0,

    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',

    paddingVertical: 16,

    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },

  btn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: 'center',
    alignItems: 'center',
  },

  iconImg: {
    width: 32,
    height: 32,
    tintColor: '#777',
  },

  activeImg: {
    tintColor: 'white',
  },

  iconText: {
    fontSize: 28,
    color: '#777',
  },

  activeText: {
    color: 'white',
  },
});
