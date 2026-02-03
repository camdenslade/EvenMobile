//********************************************************************
//
// User + Profile + Swipe Domain Types
//
// Single source of truth for all profile, swipe, and discovery-related
// types. These definitions match the post-swipe-system backend.
//
// Profiles come from:
//   • GET /profiles/me
//   • GET /profiles/queue
//   • GET /profiles/public/:uid
//
// Messaging + threads are defined in src/types/chat.ts.
// Message requests also handled there.
//
//*******************************************************************

//********************************************************************
//
// Sex Type
//
// Represents the biological sex of a user.
//
//*******************************************************************
export type Sex = "male" | "female";

//********************************************************************
//
// SexPreference Type
//
// Represents the sex preference for matching (who the user is
// interested in).
//
//*******************************************************************
export type SexPreference = "male" | "female" | "everyone";

//********************************************************************
//
// DatingPreference Type
//
// Represents the type of relationship the user is seeking.
//
//*******************************************************************
export type DatingPreference =
  | "hookups"
  | "situationship"
  | "short_term_relationship"
  | "short_term_open"
  | "long_term_open"
  | "long_term_relationship";

//********************************************************************
//
// UserProfile Interface
//
// Complete user profile data structure. Contract guaranteed by backend.
// All fields are present after onboarding completion.
//
// Value Parameters
// ----------------
// id                string              UUID of profile
// userUid           string              Cognito sub (used for API calls)
// name              string              Composite name (firstName + lastName)
// birthday          string              ISO date string
// age               number              Integer computed server-side
// bio               string              User's bio text
// sex               Sex                 User's biological sex
// sexPreference     SexPreference       Who user is interested in
// datingPreference  DatingPreference    Type of relationship sought
// interests         string[]            Array of interest strings
// photos            string[]            Array of S3 photo URLs
// photoOriginals    string[]|undefined  Array of original photo URLs (aligned with photos)
// profileImageUrl   string              Always present (equals photos[0])
// latitude          number|null         Location latitude (null until permissions granted)
// longitude         number|null         Location longitude (null until permissions granted)
// paused            boolean             Whether profile is hidden from discovery
// distance          number|undefined    Distance in miles (only for queue responses)
//
//*******************************************************************
export interface UserProfile {
  id: string;  // Database UUID
  userUid: string;  // Cognito sub (used for API calls)

  name: string;
  birthday: string;
  age: number;

  bio: string;

  sex: Sex;
  sexPreference: SexPreference;
  datingPreference: DatingPreference;

  interests: string[];

  photos: string[];
  photoOriginals?: string[];
  profileImageUrl: string;  // always present after onboarding

  latitude: number | null;
  longitude: number | null;

  paused: boolean;
  showSchoolInfo?: boolean | null;
  school?: string | null;
  major?: string | null;
  gradYear?: number | null;

  distance?: number; // Distance in miles (only for queue responses)

  // Hinge-like preference fields (arrays for multi-select)
  height?: string[] | null;
  race?: string[] | null;
  religion?: string[] | null;
  politics?: string[] | null;
  education?: string[] | null;
  activityLevel?: string | null;
  drinking?: string[] | null;
  smoking?: string[] | null;
  marijuana?: string[] | null;

  // Discovery filter preferences
  prefMinAge?: number;
  prefMaxAge?: number;
  prefMinDistanceMiles?: number;
  prefMaxDistanceMiles?: number;
  prefMinHeight?: number | null; // Minimum height in inches
  prefMaxHeight?: number | null; // Maximum height in inches
  prefRace?: string[] | null;
  prefReligion?: string[] | null;
  prefPolitics?: string[] | null;
  prefEducation?: string[] | null;
  prefActivityLevel?: string | null;
  prefDrinking?: string[] | null;
  prefSmoking?: string[] | null;
  prefMarijuana?: string[] | null;
  expandAge?: boolean;
  expandDistance?: boolean;
  expandHeight?: boolean;
  showOutsideRange?: boolean;
}

//********************************************************************
//
// SwipeAction Type
//
// Represents the type of swipe action performed by the user.
// "LIKE" triggers POST /like endpoint, "SKIP" is local-only.
//
//*******************************************************************
export type SwipeAction = "LIKE" | "SKIP";
