//********************************************************************
//
// Onboarding Styles Constant
//
// StyleSheet definitions for onboarding screen components.
// Provides consistent styling for container, header, error messages,
// labels, inputs, bio input, rows, selectors, photo grid, photo
// thumbnails, and submit wrapper.
//
// Return Value
// ------------
// StyleSheet    React Native StyleSheet object
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

import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#000",
  },
  header: {
    fontSize: 26,
    marginBottom: 20,
    color: "#fff",
  },
  error: {
    color: "red",
    marginVertical: 8,
  },
  label: {
    marginTop: 20,
    marginBottom: 5,
    fontSize: 16,
    color: "#fff",
  },
  input: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 6,
  },
  bioInput: {
    height: 100,
  },
  row: {
    flexDirection: "row",
    marginBottom: 10,
  },
  selector: {
    padding: 10,
    marginRight: 10,
    backgroundColor: "#666",
    borderRadius: 8,
  },
  selectorSelected: {
    backgroundColor: "#3498db",
  },
  selectorText: {
    color: "white",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  photoThumb: {
    width: 90,
    height: 90,
    marginRight: 10,
    marginTop: 10,
    borderRadius: 6,
  },
  submitWrapper: {
    marginTop: 30,
    marginBottom: 100,
  },
});
