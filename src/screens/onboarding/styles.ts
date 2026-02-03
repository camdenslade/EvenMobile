//********************************************************************
//
// Onboarding Styles
//
// Shared StyleSheet definitions for all onboarding step components.
// Centralized styles ensure consistent appearance across all steps.
//
// Return Value
// ------------
// None (exported StyleSheet object)
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
// Side Effects
// ------------
// None
//
//*******************************************************************

import { StyleSheet, Platform } from "react-native";

export const onboardingStyles = StyleSheet.create({
  back: {
    position: "absolute",
    top: 20,
    left: 12,
    zIndex: 10,
    elevation: 10,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    minHeight: Platform.OS === 'ios' ? 72 : 48,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: { fontSize: 28 },

  header: {
    fontSize: 30,
    fontWeight: "700",
    marginTop: 70,
    marginBottom: 20,
  },
  subheader: {
    fontSize: 15,
    marginBottom: 10,
  },

  input: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  label: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 10,
  },

  mainButton: {
    padding: 16,
    borderRadius: 30,
    marginTop: 40,
    marginBottom: 40,
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  mainButtonText: {
    fontSize: 18,
    fontWeight: "700",
  },

  genderOption: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  genderText: { fontSize: 18 },

  searchInput: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  interestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    margin: 6,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  interestChipText: { fontSize: 14 },

  bioInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    textAlignVertical: 'top',
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  dragOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    zIndex: 500,
  },

  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  photoBox: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dragIndicator: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    padding: 4,
  },
  dragIndicatorText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoTouchable: {
    width: "100%",
    height: "100%",
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#0007",
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
  },
  removeX: {
    color: "white",
    fontSize: 20,
    marginTop: -2,
  },
  addSlot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  addPhotoText: {
    fontSize: 42,
    fontWeight: "200",
  },

  error: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 15,
  },

  guidelinesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
  },

  declineButton: {
    padding: 16,
    borderRadius: 30,
    marginTop: 10,
    marginBottom: 40,
    alignItems: "center",
    borderWidth: 1,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  declineButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
});

