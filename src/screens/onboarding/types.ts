//********************************************************************
//
// Onboarding Types
//
// Type definitions for onboarding flow state and step enumeration.
// Used across all onboarding step components and the orchestrator.
//
// Return Value
// ------------
// None (TypeScript type definitions)
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

import { Animated } from "react-native";
import { BirthdayValue } from "../../components/BirthdayPicker";
import { HeightValue } from "../../components/HeightPicker";

export enum Step {
  EmailGate = 0,
  Consent = 1,
  BetaWelcome = 2,
  BasicInfo = 3,
  SexPreference = 4,
  DatingPreference = 5,
  Interests = 6,
  BioAndDetails = 7,
  Photos = 8,
  Guidelines = 9,
  PrivacyPolicy = 10,
  TermsOfService = 11,
}

export type SexValue = "male" | "female" | null;
export type SexPreferenceValue = "male" | "female" | "everyone" | null;
export type DatingPreferenceValue =
  | "hookups"
  | "situationship"
  | "short_term_relationship"
  | "short_term_open"
  | "long_term_open"
  | "long_term_relationship"
  | null;

export interface OnboardingState {
  name: string;
  birthday: BirthdayValue;
  sex: SexValue;
  sexPreference: SexPreferenceValue;
  datingPreference: DatingPreferenceValue;
  interests: string[];
  bio: string;
  bioHeight: number;
  photos: (string | null)[];
  height: HeightValue;
  race: string[];
  religion: string[];
  politics: string[];
  education: string[];
  activityLevel: string;
  drinking: string[];
  smoking: string[];
  marijuana: string[];
  error: string | null;
  search: string;
}

export interface OnboardingCallbacks {
  setName: (name: string) => void;
  setBirthday: (birthday: BirthdayValue) => void;
  setSex: (sex: SexValue) => void;
  setSexPreference: (pref: SexPreferenceValue) => void;
  setDatingPreference: (pref: DatingPreferenceValue) => void;
  setInterests: (interests: string[]) => void;
  setBio: (bio: string) => void;
  setBioHeight: (height: number) => void;
  setPhotos: (photos: (string | null)[]) => void;
  setHeight: (height: HeightValue) => void;
  setRace: (race: string[]) => void;
  setReligion: (religion: string[]) => void;
  setPolitics: (politics: string[]) => void;
  setEducation: (education: string[]) => void;
  setActivityLevel: (level: string) => void;
  setDrinking: (drinking: string[]) => void;
  setSmoking: (smoking: string[]) => void;
  setMarijuana: (marijuana: string[]) => void;
  setError: (error: string | null) => void;
  setSearch: (search: string) => void;
}

export interface PhotoDragState {
  draggingIndex: number | null;
  hoverIndex: number | null;
  isDraggingRef: React.MutableRefObject<boolean>;
  dragPositions: React.MutableRefObject<{ [key: number]: Animated.ValueXY }>;
  slotPositions: React.MutableRefObject<{ [key: number]: { x: number; y: number } }>;
}

export interface PhotoCropState {
  cropModalVisible: boolean;
  imageToCrop: string | null;
  cropTargetIndex: number | null;
  setCropModalVisible: (visible: boolean) => void;
  setImageToCrop: (uri: string | null) => void;
  setCropTargetIndex: (index: number | null) => void;
}

