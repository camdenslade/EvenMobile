//********************************************************************
//
// usePhotoPicker Hook
//
// Custom hook for handling photo selection and cropping in onboarding.
// Manages image picker interactions, compression, and crop modal state.
// Supports both single photo selection (with cropping) and multiple
// photo selection for batch uploads.
//
// Return Value
// ------------
// Object    Object containing pickPhoto, handleCropComplete, handleCropCancel,
//           removePhoto functions and crop state
//
// Value Parameters
// ----------------
// photos                (string|null)[]    Current photos array
// setPhotos             function            Photos setter function
// setCropModalVisible   function            Crop modal visibility setter
// setImageToCrop        function            Image to crop URI setter
// setCropTargetIndex    function            Crop target index setter
//
// Reference Parameters
// --------------------
// None
//
// Local State
// -----------
// None (all state passed in via props)
//
// Side Effects
// ------------
// Opens image picker (native modal)
// Opens crop modal (React Native Modal)
//
//*******************************************************************

import * as ImagePicker from "expo-image-picker";
import { compressToJpeg } from "../utils/imageCompression";

interface UsePhotoPickerProps {
  photos: (string | null)[];
  setPhotos: React.Dispatch<React.SetStateAction<(string | null)[]>>;
  cropTargetIndex: number | null;
  imageToCrop: string | null;
  setCropModalVisible: (visible: boolean) => void;
  setImageToCrop: (uri: string | null) => void;
  setCropTargetIndex: (index: number | null) => void;
}

export function usePhotoPicker({
  photos,
  setPhotos,
  cropTargetIndex,
  imageToCrop,
  setCropModalVisible,
  setImageToCrop,
  setCropTargetIndex,
}: UsePhotoPickerProps) {
  const pickPhoto = async (index?: number) => {
    // Request permissions first
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      // Permission denied - could show an alert here if needed
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsMultipleSelection: index === undefined,
      selectionLimit: index === undefined ? 6 : 1,
    });
    if (res.canceled || !res.assets || res.assets.length === 0) return;

    // Single photo selection (with index) - show crop modal
    if (index !== undefined && res.assets.length === 1) {
      setImageToCrop(res.assets[0].uri);
      setCropTargetIndex(index);
      setCropModalVisible(true);
      return;
    }

    // Multiple photo selection (without index or when clicking empty slot)
    if (index === undefined && res.assets.length > 0) {
      // Compress all selected photos
      const compressedPhotos: string[] = [];
      for (const asset of res.assets) {
        const jpeg = await compressToJpeg(asset.uri);
        compressedPhotos.push(jpeg);
      }

      // Add uploaded photos to the first available slots
      setPhotos((prev) => {
        const updated = [...prev];
        let urlIndex = 0;

        for (let i = 0; i < updated.length && urlIndex < compressedPhotos.length; i++) {
          if (updated[i] === null) {
            updated[i] = compressedPhotos[urlIndex];
            urlIndex++;
          }
        }

        return updated;
      });
    }
  };

  const handleCropComplete = async (croppedUri: string) => {
    const targetIndex = cropTargetIndex;
    if (targetIndex === null || !imageToCrop) return;

    setCropModalVisible(false);

    const compressed = await compressToJpeg(croppedUri);

    // Update the photo at the target index
    setPhotos((prev) => {
      const updated = [...prev];
      updated[targetIndex] = compressed;
      return updated;
    });

    setImageToCrop(null);
    setCropTargetIndex(null);
  };

  const handleCropCancel = () => {
    setCropModalVisible(false);
    setImageToCrop(null);
    setCropTargetIndex(null);
  };

  const removePhoto = (i: number) => {
    setPhotos((prev) => {
      const updated = [...prev];
      updated[i] = null;
      return updated;
    });
  };

  return {
    pickPhoto,
    handleCropComplete,
    handleCropCancel,
    removePhoto,
  };
}

