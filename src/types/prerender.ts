//********************************************************************
//
// Prerenderable Interface
//
// Interface for components that support prerendering. Components
// implementing this interface should check the __prerender flag
// and return minimal or null output when prerendering.
//
// Value Parameters
// ----------------
// __prerender    boolean|undefined    Flag indicating if component is being prerendered
//
//*******************************************************************
export interface Prerenderable {
  __prerender?: boolean;
}
