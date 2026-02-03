//********************************************************************
//
// compressToJpeg Function
//
// Compresses and resizes an image to JPEG format. Resizes to max width
// 1080px with 0.7 compression quality. Used for photo uploads in
// onboarding to reduce file size while maintaining acceptable quality.
//
// Return Value
// ------------
// Promise<string>    Promise resolving to compressed JPEG URI
//
// Value Parameters
// ----------------
// uri    string    Original image URI
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// result    ImageManipulatorResult    Result from image manipulation
//
// Side Effects
// ------------
// None (pure function)
//
//*******************************************************************

import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

export async function compressToJpeg(uri: string): Promise<string> {
  const result = await manipulateAsync(uri, [{ resize: { width: 1080 } }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

