//********************************************************************
//
// useNotifications Hook
//
// Hook for managing push notifications. Handles permission requests,
// token registration, and notification tap handling. Registers token
// with backend on app start and when token changes.
//
// Return Value
// ------------
// None (React hook)
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
// navigation              NavigationProp              Navigation object
// notificationListener   Subscription|undefined      Notification received listener
// responseListener       Subscription|undefined      Notification response listener
//
//*******************************************************************

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { apiPost } from '../services/apiService';
import { useAuth } from '../context/AuthContext';

// Check if running in Expo Go (push notifications not fully supported)
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Configure notification behavior
// Don't show alerts when app is open - allow normal UI update
// Only configure if not in Expo Go (to avoid warnings)
if (!isExpoGo) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      }),
    });
  } catch (error) {
    // Silently handle if notifications aren't available
  }
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type NotificationData = {
  type?: 'message_request' | 'request_accepted' | 'new_message';
  threadId?: string;
};

export function useNotifications(): void {
  const navigation = useNavigation<NavigationProp>();
  const { user, idToken } = useAuth();

  const notificationListener =
    useRef<Notifications.Subscription | null>(null);
  const responseListener =
    useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    let isMounted = true;
    let registering = false;

    const tryRegister = async () => {
      if (!isMounted || registering || !user) return;
      registering = true;
      try {
        await registerForPushNotificationsAsync();
      } finally {
        registering = false;
      }
    };

    // Register when user logs in or token changes
    if (user && idToken) {
      tryRegister();
    }

    // Only set up notification listeners if not in Expo Go
    if (!isExpoGo) {
      try {
        notificationListener.current =
          Notifications.addNotificationReceivedListener(() => {
          });

        responseListener.current =
          Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content
          .data as NotificationData;

        if (data?.type === 'message_request') {
          navigation.navigate('Matches');
          return;
        }

        if (
          (data?.type === 'request_accepted' ||
            data?.type === 'new_message') &&
          typeof data.threadId === 'string'
        ) {
          const threadId = data.threadId;
          navigation.navigate('Messages');

          setTimeout(() => {
            navigation.navigate('Chat', { threadId });
          }, 100);
        }
          });
      } catch (error) {
        // Silently handle if notifications aren't available
      }
    }

    return () => {
      isMounted = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [navigation, user, idToken]);

  //********************************************************************
  //
  // registerForPushNotificationsAsync Function
  //
  // Requests notification permission and registers Expo push token with
  // backend. Handles permission denied gracefully by silently continuing.
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
  // permission    NotificationPermissionsStatus    Permission status
  // token         ExpoPushToken                    Expo push token object
  // error         Error                            Error object if registration fails
  //
  //*******************************************************************
  async function registerForPushNotificationsAsync(): Promise<void> {
    try {
      // Skip push notification registration in Expo Go (not supported)
      if (isExpoGo) {
        return;
      }

      if (!user || !idToken) {
        console.warn('Skipping push token registration: no authenticated user');
        return;
      }

      let permission = await Notifications.getPermissionsAsync();

      if (!permission.granted) {
        permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted) return;
      }

      const token = await Notifications.getExpoPushTokenAsync();

      if (typeof token.data === 'string') {
        await apiPost<{ success: boolean }>('/users/push-token', {
          token: token.data,
        }, idToken);
      }
    } catch (error) {
      // Silently handle errors (e.g., in Expo Go where notifications aren't supported)
      if (!isExpoGo) {
        console.error('Error registering for push notifications:', error);
      }
    }
  }
}
