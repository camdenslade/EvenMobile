//********************************************************************
//
// BottomButtonsProvider Component
//
// Provides context for passing BottomButtons props from SwipeScreen
// to NavigationWrapper. This allows the BottomButtons component to
// be rendered outside the Stack Navigator to exclude it from fade
// animations while still receiving state and callbacks from SwipeScreen.
//
// Return Value
// ------------
// React.ReactElement    JSX element with BottomButtonsContext.Provider
//
// Value Parameters
// ----------------
// children    ReactNode    Child components to wrap with bottom buttons context
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// buttonsState    BottomButtonsState|null    Current bottom buttons state
//
//*******************************************************************

import { createContext, useContext, useState, ReactNode } from 'react';
import type { Dispatch, SetStateAction } from 'react';

interface BottomButtonsState {
  disabled: boolean;
  onUndo: () => void;
  onLike: () => void;
  onMessage: () => void;
  undoTokens?: number;
  messageTokens?: number;
}

export interface BottomButtonLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BottomButtonsLayoutState {
  undo?: BottomButtonLayout;
  like?: BottomButtonLayout;
  message?: BottomButtonLayout;
}

interface BottomButtonsContextType {
  buttonsState: BottomButtonsState | null;
  setButtonsState: (state: BottomButtonsState | null) => void;
  buttonsLayout: BottomButtonsLayoutState;
  setButtonsLayout: Dispatch<SetStateAction<BottomButtonsLayoutState>>;
}

const BottomButtonsContext = createContext<BottomButtonsContextType | undefined>(undefined);

export function BottomButtonsProvider({ children }: { children: ReactNode }) {
  const [buttonsState, setButtonsState] = useState<BottomButtonsState | null>(null);
  const [buttonsLayout, setButtonsLayout] = useState<BottomButtonsLayoutState>({});

  return (
    <BottomButtonsContext.Provider value={{ buttonsState, setButtonsState, buttonsLayout, setButtonsLayout }}>
      {children}
    </BottomButtonsContext.Provider>
  );
}

//********************************************************************
//
// useBottomButtons Hook
//
// Hook to access bottom buttons context. Returns buttons state and
// setter function. Throws error if used outside BottomButtonsProvider.
//
// Return Value
// ------------
// BottomButtonsContextType    Bottom buttons context value
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
// context    BottomButtonsContextType|undefined    Context value from provider
//
//*******************************************************************
export function useBottomButtons() {
  const context = useContext(BottomButtonsContext);
  if (!context) {
    throw new Error('useBottomButtons must be used within BottomButtonsProvider');
  }
  return context;
}
