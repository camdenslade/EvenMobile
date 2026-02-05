//********************************************************************
//
// OnboardingScreen Component
//
// Orchestrator component for multi-step onboarding flow. Manages step
// state, user input state, and coordinates between step components.
// Handles photo uploads and profile submission via POST /profiles/setup.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the onboarding screen
//
// Value Parameters
// ----------------
// navigation    any         Navigation object for routing
// onComplete    function    Callback function called when onboarding completes
//
// Reference Parameters
// --------------------
// None
//
// Local State
// -----------
// step                Step enum              Current onboarding step
// name                string                  User's first name
// birthday            BirthdayValue           Selected birthday
// sex                 SexValue                Selected sex
// sexPreference       SexPreferenceValue      Selected sex preference
// datingPreference    DatingPreferenceValue   Selected dating preference
// interests           string[]                Selected interests array
// bio                 string                  User's bio text
// bioHeight           number                  Bio input height
// photos              (string|null)[]         Array of photo URIs (up to 6)
// height              HeightValue             Selected height
// race                string[]                Selected race options
// religion            string[]                Selected religion options
// politics            string[]                Selected politics options
// education           string[]                Selected education options
// activityLevel       string                  Selected activity level
// drinking            string[]                Selected drinking options
// smoking             string[]                Selected smoking options
// marijuana           string[]                Selected marijuana options
// error               string|null             Error message
// search              string                  Interest search query
// cropModalVisible    boolean                 Crop modal visibility
// imageToCrop         string|null             Image URI to crop
// cropTargetIndex     number|null             Target index for cropped image
// draggingIndex       number|null             Index of photo being dragged
// hoverIndex          number|null             Index of photo being hovered
//
// Side Effects
// ------------
// Requests location permissions
// Uploads photos to backend (PUT to signed URLs)
// Submits profile via POST /profiles/setup
// Navigates to LoginScreen if legal documents declined
//
//*******************************************************************

import { useState, useEffect, useCallback, useRef } from "react";
import { View } from "react-native";
import { useTheme } from "../../context/ThemeProvider";
import GlobalBackground from "../../components/GlobalBackground";
import { apiGet, apiPost } from "../../services/apiService";
import { BirthdayValue } from "../../components/BirthdayPicker";
import { HeightValue } from "../../components/HeightPicker";
import { Step } from "./types";
import { StepEmailGate } from "./steps/StepEmailGate";
import { StepConsent } from "./steps/StepConsent";
import { StepBetaWelcome } from "./steps/StepBetaWelcome";
import { StepBasicInfo } from "./steps/StepBasicInfo";
import { StepSexPreference } from "./steps/StepSexPreference";
import { StepDatingPreference } from "./steps/StepDatingPreference";
import { StepInterests } from "./steps/StepInterests";
import { StepBioAndDetails } from "./steps/StepBioAndDetails";
import { StepPhotos } from "./steps/StepPhotos";
import { StepGuidelines } from "./steps/StepGuidelines";
import { StepPrivacyPolicy } from "./steps/StepPrivacyPolicy";
import { StepTermsOfService } from "./steps/StepTermsOfService";
import { usePhotoPicker } from "./hooks/usePhotoPicker";
import { usePhotoDrag } from "./hooks/usePhotoDrag";
import { SexValue, SexPreferenceValue, DatingPreferenceValue } from "./types";
import { getOAuthData, clearOAuthData } from "../../services/authStorage";
import { useAuth } from "../../context/AuthContext";
import { useSessionData } from "../../context/SessionDataContext";

export default function OnboardingScreen({
  navigation,
  onComplete,
}: {
  navigation: any;
  onComplete: () => void;
}) {
  const { colors } = useTheme();
  const { userSummary } = useSessionData();
  const requireSchoolEmailGate =
    userSummary?.requireSchoolEmailGate === true;
  const [step, setStep] = useState<Step>(Step.Consent);

  // User input state
  const [name, setName] = useState("");

  // Pre-fill name from OAuth data (Google/Apple sign-in)
  useEffect(() => {
    async function loadOAuthData() {
      const oauthData = await getOAuthData();
      if (oauthData.name && !name) {
        // Only pre-fill if name is empty and OAuth name exists
        setName(oauthData.name);
      }
    }
    loadOAuthData();
  }, []);
  const currentYear = new Date().getFullYear();
  const [birthday, setBirthday] = useState<BirthdayValue>({
    year: currentYear,
    month: 0,
    day: 1,
  });
  const [sex, setSex] = useState<SexValue>(null);
  const [sexPreference, setSexPreference] = useState<SexPreferenceValue>(null);
  const [datingPreference, setDatingPreference] = useState<DatingPreferenceValue>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [bioHeight, setBioHeight] = useState(120);
  const [photos, setPhotos] = useState<(string | null)[]>(Array(6).fill(null));
  const [height, setHeight] = useState<HeightValue>({ feet: 5, inches: 6 });
  const [race, setRace] = useState<string[]>([]);
  const [religion, setReligion] = useState<string[]>([]);
  const [politics, setPolitics] = useState<string[]>([]);
  const [education, setEducation] = useState<string[]>([]);
  const [activityLevel, setActivityLevel] = useState<string>("");
  const [drinking, setDrinking] = useState<string[]>([]);
  const [smoking, setSmoking] = useState<string[]>([]);
  const [marijuana, setMarijuana] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [schoolEmailVerified, setSchoolEmailVerified] = useState<boolean | null>(null);
  const { logout } = useAuth();
  const exitToLoginRef = useRef(false);

  // Photo management state
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropTargetIndex, setCropTargetIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Photo picker hook
  const { pickPhoto, handleCropComplete, handleCropCancel, removePhoto } = usePhotoPicker({
    photos,
    setPhotos,
    cropTargetIndex,
    imageToCrop,
    setCropModalVisible,
    setImageToCrop,
    setCropTargetIndex,
  });

  // Photo drag hook
  const { panResponders, dragPositions, measureSlot, isDraggingRef } = usePhotoDrag(
    photos,
    setPhotos,
    setDraggingIndex,
    setHoverIndex
  );

  // Load school email verification status when gate is enabled
  const fetchSchoolEmailStatus = useCallback(async () => {
    if (!requireSchoolEmailGate) return;
    const me = await apiGet<{ schoolEmailVerified?: boolean }>("/users/me");
    if (me && typeof me.schoolEmailVerified === "boolean") {
      setSchoolEmailVerified(me.schoolEmailVerified);
    } else {
      setSchoolEmailVerified(false);
    }
  }, [requireSchoolEmailGate]);

  // Sync initial verification status from session data if available
  useEffect(() => {
    if (typeof userSummary?.schoolEmailVerified === "boolean") {
      setSchoolEmailVerified(userSummary.schoolEmailVerified);
    }
  }, [userSummary?.schoolEmailVerified]);

  useEffect(() => {
    fetchSchoolEmailStatus();
  }, [fetchSchoolEmailStatus]);

  useEffect(() => {
    if (!requireSchoolEmailGate) return;
    const unsubscribe = navigation.addListener("focus", fetchSchoolEmailStatus);
    return unsubscribe;
  }, [navigation, fetchSchoolEmailStatus, requireSchoolEmailGate]);

  // If gate is required, keep users on gate until verified
  useEffect(() => {
    if (!requireSchoolEmailGate) {
      if (step === Step.EmailGate) {
        setStep(Step.Consent);
      }
      return;
    }

    if (schoolEmailVerified) {
      if (step === Step.EmailGate) {
        setStep(Step.Consent);
      }
    } else {
      if (step !== Step.EmailGate) {
        setStep(Step.EmailGate);
      }
    }
  }, [requireSchoolEmailGate, schoolEmailVerified, step]);

  // Interest toggle function
  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const exitToLogin = useCallback(() => {
    if (exitToLoginRef.current) return;
    exitToLoginRef.current = true;
    void logout();
  }, [logout]);

  const handleEmailVerified = useCallback(() => {
    setSchoolEmailVerified(true);
    setStep(Step.Consent);
  }, []);

  // Handle submit
  async function handleSubmit() {
    setError(null);

    if (requireSchoolEmailGate) {
      if (schoolEmailVerified === null) {
        setError("Checking school email verification. Please try again.");
        return;
      }
      if (!schoolEmailVerified) {
        setError("Verify your school email to continue onboarding.");
        return;
      }
    }

    if (!sex) return setError("Select your sex.");
    if (!sexPreference) return setError("Select who you're interested in.");

    const realPhotos = photos.filter((p) => p !== null);
    if (realPhotos.length < 1) return setError("At least one photo required.");

    const uploadedUrls: string[] = [];
    const uploadedOriginals: string[] = [];

    for (const local of realPhotos) {
      if (!local) continue;

      const signed = await apiGet<{
        uploadUrlOriginal: string;
        keyOriginal: string;
        uploadUrlDerived: string;
        keyDerived: string;
        error?: string;
      }>("/profiles/upload-url?fileType=image/jpeg");

      if (!signed || signed.error || !signed.keyOriginal || !signed.keyDerived) {
        setError("Photo upload failed.");
        return;
      }

      const blob = await (await fetch(local)).blob();
      const uploadOriginal = await fetch(signed.uploadUrlOriginal, {
        method: "PUT",
        headers: {
          "Content-Type": "image/jpeg",
          "x-amz-server-side-encryption": "AES256",
        },
        body: blob,
      });

      if (!uploadOriginal.ok) {
        const errBody = await uploadOriginal.text().catch(() => "(no body)");
        console.error("Failed to upload original to S3:", uploadOriginal.status, uploadOriginal.statusText, errBody);
        setError("Photo upload failed.");
        return;
      }

      const uploadResponse = await fetch(signed.uploadUrlDerived, {
        method: "PUT",
        headers: {
          "Content-Type": "image/jpeg",
          "x-amz-server-side-encryption": "AES256",
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        const errBody = await uploadResponse.text().catch(() => "(no body)");
        console.error("Failed to upload to S3:", uploadResponse.status, uploadResponse.statusText, errBody);
        setError("Photo upload failed.");
        return;
      }

      uploadedUrls.push(signed.keyDerived);
      uploadedOriginals.push(signed.keyOriginal);
    }

    // Transform payload to match backend DTO structure
    const payload = {
      name: name.trim(),
      birthday: {
        year: birthday.year,
        month: birthday.month,
        day: birthday.day,
      },
      bio,
      sex,
      sexPreference,
      datingPreference,
      interests,
      photos: uploadedUrls,
      photoOriginals: uploadedOriginals,
      height: [
        {
          feet: height.feet,
          inches: height.inches,
        },
      ],
      race: race,
      religion: religion.length > 0 ? religion : undefined,
      politics: politics.length > 0 ? politics : undefined,
      education: education.length > 0 ? education : undefined,
      activityLevel: activityLevel ? activityLevel : undefined,
      drinking: drinking.length > 0 ? drinking : undefined,
      smoking: smoking.length > 0 ? smoking : undefined,
      marijuana: marijuana.length > 0 ? marijuana : undefined,
    };

    const result = await apiPost("/profiles/setup", payload);
    if (!result) {
      setError("Setup failed");
      return;
    }

    // Clear OAuth data after successful onboarding
    await clearOAuthData();
    onComplete();
  }

  // Render step based on current step
  // GlobalBackground is rendered once at the onboarding level
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GlobalBackground />
      {(() => {
        switch (step) {
          case Step.EmailGate:
            return (
              <StepEmailGate
                colors={colors}
                onVerified={handleEmailVerified}
                onExit={exitToLogin}
              />
            );

          case Step.Consent:
            return (
              <StepConsent
                colors={colors}
                onAllow={() => setStep(Step.BetaWelcome)}
                onDecline={exitToLogin}
              />
            );

          case Step.BetaWelcome:
            return (
              <StepBetaWelcome
                colors={colors}
                onContinue={() => setStep(Step.BasicInfo)}
              />
            );

          case Step.BasicInfo:
            return (
              <StepBasicInfo
                colors={colors}
                name={name}
                birthday={birthday}
                sex={sex}
                error={error}
                setName={setName}
                setBirthday={setBirthday}
                setSex={setSex}
                setError={setError}
                onContinue={() => setStep(Step.SexPreference)}
                onUnderage={exitToLogin}
              />
            );

          case Step.SexPreference:
            return (
              <StepSexPreference
                colors={colors}
                sexPreference={sexPreference}
                setSexPreference={setSexPreference}
                onContinue={() => setStep(Step.DatingPreference)}
                onBack={() => setStep(Step.BasicInfo)}
              />
            );

          case Step.DatingPreference:
            return (
              <StepDatingPreference
                colors={colors}
                birthday={birthday}
                datingPreference={datingPreference}
                setDatingPreference={setDatingPreference}
                onContinue={() => setStep(Step.Interests)}
                onBack={() => setStep(Step.SexPreference)}
              />
            );

          case Step.Interests:
            return (
              <StepInterests
                colors={colors}
                interests={interests}
                search={search}
                toggleInterest={toggleInterest}
                setSearch={setSearch}
                onContinue={() => setStep(Step.BioAndDetails)}
                onBack={() => setStep(Step.DatingPreference)}
              />
            );

          case Step.BioAndDetails:
            return (
              <StepBioAndDetails
                colors={colors}
                bio={bio}
                bioHeight={bioHeight}
                height={height}
                race={race}
                religion={religion}
                politics={politics}
                education={education}
                activityLevel={activityLevel}
                drinking={drinking}
                smoking={smoking}
                marijuana={marijuana}
                error={error}
                setBio={setBio}
                setBioHeight={setBioHeight}
                setHeight={setHeight}
                setRace={setRace}
                setReligion={setReligion}
                setPolitics={setPolitics}
                setEducation={setEducation}
                setActivityLevel={setActivityLevel}
                setDrinking={setDrinking}
                setSmoking={setSmoking}
                setMarijuana={setMarijuana}
                setError={setError}
                onContinue={() => setStep(Step.Photos)}
                onBack={() => setStep(Step.Interests)}
              />
            );

          case Step.Photos:
            return (
              <StepPhotos
                colors={colors}
                photos={photos}
                draggingIndex={draggingIndex}
                hoverIndex={hoverIndex}
                cropModalVisible={cropModalVisible}
                imageToCrop={imageToCrop}
                cropTargetIndex={cropTargetIndex}
                error={error}
                setDraggingIndex={setDraggingIndex}
                setHoverIndex={setHoverIndex}
                pickPhoto={pickPhoto}
                handleCropComplete={handleCropComplete}
                handleCropCancel={handleCropCancel}
                removePhoto={removePhoto}
                panResponders={panResponders}
                dragPositions={dragPositions}
                measureSlot={measureSlot}
                isDraggingRef={isDraggingRef}
                onContinue={() => setStep(Step.Guidelines)}
                onBack={() => setStep(Step.BioAndDetails)}
              />
            );

          case Step.Guidelines:
            return (
              <StepGuidelines
                colors={colors}
                onAccept={() => setStep(Step.PrivacyPolicy)}
                onDecline={exitToLogin}
              />
            );

          case Step.PrivacyPolicy:
            return (
              <StepPrivacyPolicy
                colors={colors}
                onAccept={() => setStep(Step.TermsOfService)}
                onDecline={exitToLogin}
                onBack={() => setStep(Step.Guidelines)}
              />
            );

          case Step.TermsOfService:
            return (
              <StepTermsOfService
                colors={colors}
                onAccept={handleSubmit}
                onDecline={exitToLogin}
                onBack={() => setStep(Step.PrivacyPolicy)}
              />
            );

          default:
            return null;
        }
      })()}
    </View>
  );
}
