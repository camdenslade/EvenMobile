import AsyncStorage from '@react-native-async-storage/async-storage';

const TUTORIAL_STORAGE_KEY = '@EvenApp:tutorialCompleted';

export async function hasSeenTutorial(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Failed to check tutorial status:', error);
    return false;
  }
}

export async function markTutorialComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
  } catch (error) {
    console.error('Failed to mark tutorial as complete:', error);
  }
}

export async function resetTutorial(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TUTORIAL_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to reset tutorial:', error);
  }
}
