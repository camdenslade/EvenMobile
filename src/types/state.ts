//********************************************************************
//
// Swipe State Machine Types
//
// Defines all possible states used by the swipe engine (useSwipeQueue).
// These states control UI behavior, loading indicators, match modals,
// error fallbacks, and swipe restrictions. The swipe deck operates as
// a finite-state machine (FSM). At any moment, exactly one state is active.
//
// Where Used:
//   • useSwipeQueue() hook => updates & returns the current state
//   • SwipeScreen          => disables input when not IDLE
//   • MatchModal           => opened when state = MATCH_FOUND
//
//*******************************************************************

import { UserProfile } from "./user";

//********************************************************************
//
// IdleState Interface
//
// Normal UI operation — user can swipe, undo, or interact.
//
// Value Parameters
// ----------------
// status          "IDLE"                 Constant status identifier
// currentProfile  UserProfile|null       The topmost profile in the queue (or null)
//
//*******************************************************************
export interface IdleState {
  status: "IDLE";
  currentProfile: UserProfile | null;
}

//********************************************************************
//
// LoadingState Interface
//
// A swipe was initiated and backend evaluation is in progress.
// UI should disable input.
//
// Value Parameters
// ----------------
// status          "LOADING"              Constant status identifier
// targetProfileId string                 The profile being evaluated (LIKE / SKIP)
//
//*******************************************************************
export interface LoadingState {
  status: "LOADING";
  targetProfileId: string;
}

//********************************************************************
//
// ErrorState Interface
//
// Backend interaction failed (network, validation, etc.).
// UI may show a toast, alert, or fallback message.
//
// Value Parameters
// ----------------
// status          "ERROR"                Constant status identifier
// errorMessage    string                 User-friendly explanation
// targetProfileId string                 Swipe that triggered the error
//
//*******************************************************************
export interface ErrorState {
  status: "ERROR";
  errorMessage: string;
  targetProfileId: string;
}

//********************************************************************
//
// MatchFoundState Interface
//
// User swiped LIKE and backend returned a match.
// SwipeScreen should open the MatchModal automatically.
//
// Value Parameters
// ----------------
// status         "MATCH_FOUND"           Constant status identifier
// matchId        string                  ID of created match (backend)
// targetProfile  UserProfile             Profile that matched
// mePhoto        string|null|undefined   Current user's first photo
// themPhoto      string|null|undefined   Matched user's first photo
//
//*******************************************************************
export interface MatchFoundState {
  status: "MATCH_FOUND";
  matchId: string;
  targetProfile: UserProfile;
  mePhoto?: string | null;
  themPhoto?: string | null;
}

//********************************************************************
//
// MessageSentState Interface
//
// After auto-messaging (paid features / future implementation),
// backend confirms a message was sent.
//
// Value Parameters
// ----------------
// status         "MESSAGE_SENT"          Constant status identifier
// matchId        string                  Match reference
// threadId       string                  Chat thread created
// targetProfile  UserProfile             Who message was sent to
//
//*******************************************************************
export interface MessageSentState {
  status: "MESSAGE_SENT";
  matchId: string;
  threadId: string;
  targetProfile: UserProfile;
}

//********************************************************************
//
// SwipeState Type (Union)
//
// Union of ALL possible swipe states. Use this wherever the swipe
// machine state is stored or returned.
//
// Example:
//   const [state, setState] = useState<SwipeState>({ status: "IDLE", ... });
//
//*******************************************************************
export type SwipeState =
  | IdleState
  | LoadingState
  | ErrorState
  | MatchFoundState
  | MessageSentState;
