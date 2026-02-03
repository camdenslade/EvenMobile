//********************************************************************
//
// PrerenderScreens Component
//
// Prerenders screen components off-screen to improve navigation
// performance. Staggers prerendering with delays to avoid blocking
// the main thread. Renders screens with __prerender flag set to true
// in a hidden container. Screens are prerendered in priority order
// (most used screens first).
//
// Return Value
// ------------
// React.ReactElement    JSX element with hidden prerendered screens
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
// prerenderedCount    number              Number of screens prerendered so far
// timeoutRefs         NodeJS.Timeout[]    Array of timeout IDs for cleanup
// staggerDelay        number              Delay between each screen (100ms)
// initialDelay        number              Initial delay before starting (500ms)
// delay               number              Calculated delay for current screen
// timeoutId           NodeJS.Timeout      Timeout ID for current screen
// screensToRender     Array               Array of screens to render up to count
// screen              Object              Screen object with name and component
// ScreenComponent     Component           Screen component to render
// id                  NodeJS.Timeout      Timeout ID in cleanup loop
//
//*******************************************************************

import { useEffect, useState, useRef } from "react";
import { View, StyleSheet } from "react-native";
import SwipeScreen from "../screens/SwipeScreen";
import MatchesScreen from "../screens/matches/MatchesScreen";
import MessagesScreen from "../screens/messages/MessagesScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import EditProfileScreen from "../screens/profile/EditProfileScreen";
import SearchScreen from "../screens/profile/SearchScreen";
import UserProfileViewScreen from "../screens/profile/UserProfileViewScreen";
import SettingsScreen from "../screens/SettingsScreen";
import SafetyScreen from "../screens/SafetyScreen";
import ReviewsListScreen from "../screens/reviews/ReviewsListScreen";

const SCREENS_TO_PRERENDER = [
  { name: "Swipe", component: SwipeScreen },
  { name: "Matches", component: MatchesScreen },
  { name: "Messages", component: MessagesScreen },
  { name: "Profile", component: ProfileScreen },
  { name: "EditProfile", component: EditProfileScreen },
  { name: "Search", component: SearchScreen },
  { name: "UserProfileView", component: UserProfileViewScreen },
  { name: "Settings", component: SettingsScreen },
  { name: "Safety", component: SafetyScreen },
  { name: "ReviewsList", component: ReviewsListScreen },
];

export default function PrerenderScreens() {
  const [prerenderedCount, setPrerenderedCount] = useState(0);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    const staggerDelay = 100;
    const initialDelay = 500;

    SCREENS_TO_PRERENDER.forEach((screen, index) => {
      const delay = initialDelay + index * staggerDelay;
      
      const timeoutId = setTimeout(() => {
        setPrerenderedCount((prev) => prev + 1);
      }, delay);

      timeoutRefs.current.push(timeoutId);
    });

    return () => {
      timeoutRefs.current.forEach((id) => clearTimeout(id));
      timeoutRefs.current = [];
    };
  }, []);

  const screensToRender = SCREENS_TO_PRERENDER.slice(0, prerenderedCount);

  return (
    <View pointerEvents="none" style={styles.hidden}>
      {screensToRender.map((screen) => {
        const ScreenComponent = screen.component;
        return <ScreenComponent key={screen.name} __prerender />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
  },
});
