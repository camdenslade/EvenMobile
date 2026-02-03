//********************************************************************
//
// App Component
//
// Root app entry point. Sets up global providers (Theme, Location,
// BottomButtons), navigation stack, and prerender system. Configures
// navigation with fade animations and disabled gesture navigation.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the root app
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

import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppRegistry } from "react-native";

import AuthLoadingScreen from "./src/screens/login/AuthLoadingScreen";
import LoginScreen from "./src/screens/login/LoginScreen";
import PhoneAuthScreen from "./src/screens/login/PhoneAuthScreen";
import OnboardingScreen from "./src/screens/onboarding/OnboardingScreen";

import SwipeScreen from "./src/screens/SwipeScreen";
import MatchesScreen from "./src/screens/matches/MatchesScreen";
import MessagesScreen from "./src/screens/messages/MessagesScreen";
import ChatScreen from "./src/screens/messages/ChatScreen";

import ProfileScreen from "./src/screens/profile/ProfileScreen";
import EditProfileScreen from "./src/screens/profile/EditProfileScreen";
import PreferencesScreen from "./src/screens/profile/PreferencesScreen";
import SearchScreen from "./src/screens/profile/SearchScreen";
import UserProfileViewScreen from "./src/screens/profile/UserProfileViewScreen";

import SettingsScreen from "./src/screens/SettingsScreen";
import SafetyScreen from "./src/screens/SafetyScreen";
import SuggestionsScreen from "./src/screens/SuggestionsScreen";
import SupportScreen from "./src/screens/SupportScreen";

import ReviewsListScreen from "./src/screens/reviews/ReviewsListScreen";
import ReviewWriteScreen from "./src/screens/reviews/ReviewWriteScreen";
import ReviewDetailScreen from "./src/screens/reviews/ReviewDetailScreen";
import BlockListScreen from "./src/screens/profile/BlockListScreen";

import { ThemeProvider } from "./src/context/ThemeProvider";
import { LocationProvider } from "./src/context/LocationProvider";
import { BottomButtonsProvider } from "./src/context/BottomButtonsContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { SessionDataProvider } from "./src/context/SessionDataContext";
import { RefreshProvider } from "./src/context/RefreshContext";
import PrerenderScreens from "./src/services/PrerenderScreens";
import NavigationWrapper from "./src/components/NavigationWrapper";
import { useSessionData } from "./src/context/SessionDataContext";
import { useAppCache } from "./src/services/appCache";
import { ErrorBoundary } from "./src/components/ErrorBoundary";

// Runtime validation for required environment variables (Blocker #1)
if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
  throw new Error("Missing EXPO_PUBLIC_API_BASE_URL");
}
if (!process.env.EXPO_PUBLIC_COGNITO_APP_CLIENT_ID) {
  throw new Error("Missing EXPO_PUBLIC_COGNITO_APP_CLIENT_ID");
}

export type RootStackParamList = {
  AuthLoading: undefined;
  Login: undefined;

  PhoneAuth: { provider: string; requiresOAuthLink?: boolean };
  Onboarding: undefined;

  Swipe: { refreshQueue?: boolean } | undefined;
  Matches: undefined;
  Messages: undefined;
  Chat: { threadId?: string; matchId?: string | null; targetId?: string; targetName?: string | null };

  Profile: undefined;
  EditProfile: {
    prefillSchool?: string | null;
    prefillMajor?: string | null;
    prefillGradYear?: number | null;
    showSchoolInfo?: boolean;
  } | undefined;
  Preferences: undefined;

  Search: undefined;
  Settings: undefined;
  Safety: undefined;
  Suggestions: undefined;
  Support: undefined;
  BlockList: undefined;

  ReviewsList: undefined;
  ReviewWrite: { targetId: string; forceReport?: boolean };
  ReviewDetail: {
    targetUid: string;
    targetName?: string | null;
    targetPhoto?: string | null;
    reviewId?: string | null;
    reviewerUid?: string;
    reviewerName?: string | null;
    rating?: number;
    comment?: string | null;
    createdAt?: string | number;
  };

  UserProfileView: { userId: string; fromSwipeCard?: boolean; previewData?: any; matchId?: string | null; targetName?: string | null; fromChat?: boolean; fromBlockList?: boolean; fromReview?: boolean };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

//********************************************************************
//
// AuthRouter Component
//
// Handles navigation routing based on auth state from AuthContext.
// Shows loading screen while auth initializes, login flow when not
// authenticated, and authenticated app flow when user exists.
//
// Return Value
// ------------
// React.ReactElement    JSX element with appropriate navigator
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
// user        User|null           Current authenticated user from context
// loading     boolean             Whether auth state is still initializing
//
//*******************************************************************
function AuthRouter() {
  const { user, loading: authLoading } = useAuth();
  const { profileStatus, loading: sessionLoading, refreshSessionData } = useSessionData();
  const cachedProfile = useAppCache((s) => s.profile);
  const profileRetryRef = useRef(0);
  const lastAuthLogRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      profileRetryRef.current = 0;
      return;
    }
    if (authLoading || sessionLoading || profileStatus) {
      return;
    }
    if (profileRetryRef.current < 1) {
      profileRetryRef.current += 1;
      void refreshSessionData();
    }
  }, [authLoading, profileStatus, refreshSessionData, sessionLoading, user]);

  const resolvedProfileStatus =
    profileStatus ?? (cachedProfile ? { status: "complete" } : null);

  const shouldLogAuth = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_AUTH === "true";
  if (shouldLogAuth) {
    const logState = JSON.stringify({
      authLoading,
      hasUser: !!user,
      sessionLoading,
      hasProfile: !!resolvedProfileStatus,
      profileStatus: resolvedProfileStatus,
    });
    if (logState !== lastAuthLogRef.current) {
      lastAuthLogRef.current = logState;
      console.log("AUTH ROUTER STATE", JSON.parse(logState));
    }
  }

  // Gate while auth/session are loading
  if (authLoading || sessionLoading) {
    return <AuthLoadingScreen />;
  }

  // Unauthenticated flow
  if (!user) {
    return (
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          animation: "fade",
          animationDuration: 100,
          freezeOnBlur: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
          animationTypeForReplace: "pop",
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
      </Stack.Navigator>
    );
  }

  const needsPhoneForAppleSignup =
    !!user &&
    !user.phoneNumber &&
    (!profileStatus || profileStatus.status !== "complete") &&
    user.providerData?.some((p) => p?.providerId === "apple.com");

  // Onboarding flow for incomplete profiles (optionally start with phone link for Apple-only users)
  if (!resolvedProfileStatus || resolvedProfileStatus.status !== "complete") {
    return (
      <Stack.Navigator
        initialRouteName={needsPhoneForAppleSignup ? "PhoneAuth" : "Onboarding"}
        screenOptions={{
          headerShown: false,
          animation: "fade",
          animationDuration: 100,
          freezeOnBlur: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
          animationTypeForReplace: "pop",
        }}
      >
        <Stack.Screen
          name="PhoneAuth"
          component={PhoneAuthScreen}
          initialParams={{ provider: "Phone", requiresOAuthLink: true }}
        />

        <Stack.Screen name="Onboarding">
          {(props) => (
            <OnboardingScreen
              {...props}
              onComplete={() =>
                props.navigation.reset({
                  index: 0,
                  routes: [{ name: "Swipe" }],
                })
              }
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Swipe" component={SwipeScreen} />
        <Stack.Screen name="Matches" component={MatchesScreen} />
        <Stack.Screen name="Messages" component={MessagesScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Preferences" component={PreferencesScreen} />
        <Stack.Screen
          name="UserProfileView"
          component={UserProfileViewScreen}
          options={{
            presentation: "transparentModal",
            animation: "fade",
            animationDuration: 300,
          }}
        />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Safety" component={SafetyScreen} />
        <Stack.Screen name="Suggestions" component={SuggestionsScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="BlockList" component={BlockListScreen} />
        <Stack.Screen name="ReviewsList" component={ReviewsListScreen} />
        <Stack.Screen name="ReviewWrite" component={ReviewWriteScreen} />
        <Stack.Screen name="ReviewDetail" component={ReviewDetailScreen} />
      </Stack.Navigator>
    );
  }

  // Authenticated flow
  return (
    <Stack.Navigator
      initialRouteName="Swipe"
      screenOptions={{
        headerShown: false,
        animation: "fade",
        animationDuration: 100,
        freezeOnBlur: false,
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        animationTypeForReplace: "pop",
      }}
    >
      <Stack.Screen name="Swipe" component={SwipeScreen} />
      <Stack.Screen name="Matches" component={MatchesScreen} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Preferences" component={PreferencesScreen} />
      <Stack.Screen
        name="UserProfileView"
        component={UserProfileViewScreen}
        options={{
          presentation: "transparentModal",
          animation: "fade",
          animationDuration: 300,
        }}
      />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Safety" component={SafetyScreen} />
      <Stack.Screen name="Suggestions" component={SuggestionsScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="BlockList" component={BlockListScreen} />
      <Stack.Screen name="ReviewsList" component={ReviewsListScreen} />
      <Stack.Screen name="ReviewWrite" component={ReviewWriteScreen} />
      <Stack.Screen name="ReviewDetail" component={ReviewDetailScreen} />
    </Stack.Navigator>
  );
}

function AppContent() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthProvider>
            <SessionDataProvider>
              <RefreshProvider>
                <ThemeProvider>
                  <LocationProvider>
                    <BottomButtonsProvider>
                      <NavigationWrapper>
                        <AuthRouter />
                        <PrerenderScreens />
                      </NavigationWrapper>
                    </BottomButtonsProvider>
                  </LocationProvider>
                </ThemeProvider>
              </RefreshProvider>
            </SessionDataProvider>
          </AuthProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  return <AppContent />;
}

// Register alternate app key used by some native entry points to avoid
// "Component auth has not been registered yet" runtime errors.
AppRegistry.registerComponent("auth", () => App);
