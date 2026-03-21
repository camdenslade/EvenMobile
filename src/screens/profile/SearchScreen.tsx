//********************************************************************
//
// SearchScreen Component
//
// Allows users to search for profiles by name. Displays search results
// with profile photos, names, ages, distances, bios, and rating gauges.
// Fetches rating summaries for each result. Supports prerender mode.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the search screen
//
// Value Parameters
// ----------------
// navigation    any         Navigation object for routing
// __prerender   boolean     Flag for prerendering (returns null if true)
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// colors         Object                  Theme colors
// query          string                  Search query input
// loading        boolean                 Loading state
// results        SearchResult[]          Search results from API
// ratings        Record<string,RatingSummary> Rating summaries by userUid
// error          string|null             Error message
// data           SearchResult[]|null     Response from /search endpoint
// summaries      Record<string,RatingSummary> Temporary ratings object
// summary        RatingSummary|null      Rating summary for each result
// r              SearchResult            Current result in map
// rating         RatingSummary|undefined Rating for current result
//
//*******************************************************************

import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { AppImage } from "../../components/AppImage";
import * as Location from "expo-location";

import Ionicons from "@expo/vector-icons/Ionicons";
import { apiGet } from "../../services/apiService";
import { useTheme } from "../../context/ThemeProvider";
import { useAuth } from "../../context/AuthContext";
import GlobalBackground from "../../components/GlobalBackground";
import { useSessionData } from "../../context/SessionDataContext";
import { PurchaseOptionsModal } from "../../components/PurchaseOptionsModal";
import { InlineAlert } from "../../components/InlineAlert";
import { normalizePhotos } from "../../utils/photoUtils";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

interface SearchResult {
  userUid: string;
  name: string;
  age: number;
  bio: string;
  profileImageUrl: string | null;
  distanceMiles: number;
  photos?: (string | null)[];
  datingPreference?: string;
  school?: string;
  major?: string;
  gradYear?: number;
  showSchoolInfo?: boolean;
}

interface SearchScreenProps {
  navigation?: any;
  __prerender?: boolean;
}

export default function SearchScreen({
  navigation,
  __prerender,
}: SearchScreenProps) {
  const { colors } = useTheme();
  const { idToken } = useAuth();
  const { userSummary, paymentFlags, userFlags, refreshSessionData } = useSessionData();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number } | null>(null);

  const isAuthenticated = !!idToken;

  const canUseSearch = () => {
    // Unauthenticated users have already paid via Apple IAP (token gate is on login screen)
    if (!isAuthenticated) return true;

    const pf = paymentFlags || {
      enablePayments: true,
      enableSearchTokens: true,
      enableUndoTokens: true,
      enableMessageReqTokens: true,
    };
    const uf = userFlags || {
      unlimitedSearch: false,
      unlimitedUndo: false,
      unlimitedMessageReq: false,
    };

    if (!pf.enablePayments) return true;
    if (!pf.enableSearchTokens) return true;
    if (uf.unlimitedSearch) return true;
    return (userSummary?.searchTokens ?? 0) > 0;
  };

  if (__prerender) return null;

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Request location for unauthenticated searches
  useEffect(() => {
    if (isAuthenticated) return;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== "granted") return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((loc) => {
        setDeviceLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }).catch(() => {});
    }).catch(() => {});
  }, [isAuthenticated]);

  async function handleSearch() {
    if (!canUseSearch()) {
      setShowPurchaseModal(true);
      return;
    }

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(async () => {
      setError(null);
      setLoading(true);
      setResults([]);

      const trimmed = query.trim();
      if (!trimmed || trimmed.length < 3) {
        setError("Enter at least 3 characters.");
        setLoading(false);
        return;
      }

      try {
        let data: SearchResult[] | null = null;

        if (!isAuthenticated) {
          // Public endpoint — no auth, no token consumption
          let url = `${API_BASE}/search/name/public?name=${encodeURIComponent(trimmed)}&radius=25`;
          if (deviceLocation) {
            url += `&lat=${deviceLocation.lat}&lng=${deviceLocation.lng}`;
          }
          const res = await fetch(url);
          data = res.ok ? await res.json() : null;
        } else {
          data = await apiGet<SearchResult[]>(
            `/search/name?name=${encodeURIComponent(trimmed)}`,
            idToken,
          );
        }

        if (!data) {
          setError("Search failed.");
          setLoading(false);
          if (isAuthenticated) {
            refreshSessionData().catch(() => {});
          }
          return;
        }

        setResults(data);
        setLoading(false);
        setHasSearched(true);

        if (isAuthenticated) {
          refreshSessionData().catch(() => {});
        }
      } catch (error) {
        console.error("Search API error:", error);
        setError("Search failed. Please try again.");
        setLoading(false);
        if (isAuthenticated) {
          refreshSessionData().catch(() => {});
        }
      }
    }, 250);
  }

  const handleGoBack = () => {
    if (results.length > 0) {
      setShowExitModal(true);
    } else {
      navigation.goBack();
    }
  };

  const confirmExit = () => {
    setShowExitModal(false);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <TouchableOpacity
        style={styles.backButton}
        onPress={handleGoBack}
        accessible={true}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        accessibilityHint="Returns to previous screen"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name="chevron-back"
          size={30}
          color={colors.text}
          accessible={false}
          importantForAccessibility="no"
        />
      </TouchableOpacity>

      <Text
        style={[styles.title, { color: colors.text }]}
        accessible={true}
        accessibilityRole="header"
        allowFontScaling={true}
      >
        Search
      </Text>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: hasSearched ? colors.card + '80' : colors.card,
            color: hasSearched ? colors.subtitle : colors.text,
          },
        ]}
        placeholder="Enter name"
        placeholderTextColor={colors.subtitle}
        value={query}
        onChangeText={setQuery}
        editable={!hasSearched}
        accessible={true}
        accessibilityLabel="Search name input"
        accessibilityRole="none"
        accessibilityHint="Enter a name to search for profiles"
        allowFontScaling={true}
      />

      <TouchableOpacity
        style={[
          styles.searchBtn,
          {
            backgroundColor: hasSearched ? colors.card : colors.accent,
            opacity: hasSearched ? 0.5 : 1,
          },
        ]}
        onPress={handleSearch}
        disabled={hasSearched || loading}
        accessible={true}
        accessibilityLabel="Search"
        accessibilityRole="button"
        accessibilityHint="Searches for profiles matching the entered name"
        accessibilityState={{ disabled: loading || hasSearched }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text
          style={[
            styles.searchText,
            { color: hasSearched ? colors.subtitle : colors.buttonText },
          ]}
          allowFontScaling={true}
          accessible={false}
          importantForAccessibility="no"
        >
          Search
        </Text>
      </TouchableOpacity>

      {loading && (
        <View
          style={styles.loadingWrap}
          accessible={true}
          accessibilityLabel="Searching"
          accessibilityRole="none"
        >
          <ActivityIndicator size="large" color={colors.text} />
          <Text
            style={[styles.loadingText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Searching…
          </Text>
        </View>
      )}

      {error && <InlineAlert message={error} style={{ marginBottom: 10 }} />}

      <ScrollView
        style={styles.results}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.resultsContent}
        accessible={false}
        importantForAccessibility="no"
      >
        <View style={styles.resultsGrid}>
          {results.map((r) => {
            const displayName = r.age ? `${r.name} • ${r.age}` : r.name;
            const photos = normalizePhotos(r.photos, r.profileImageUrl ?? null);
            const photoUrl = photos[0] ?? "https://via.placeholder.com/100";

            return (
              <TouchableOpacity
                key={r.userUid}
                style={[
                  styles.resultCard,
                  styles.cardShadow,
                  { backgroundColor: '#ffffff', borderColor: '#e0e0e0' },
                ]}
                onPress={() => {
                  navigation.navigate("UserProfileView", {
                    userId: r.userUid,
                  });
                }}
                accessible={true}
                accessibilityLabel={`${r.name}, age ${r.age}. Tap to view profile`}
                accessibilityRole="button"
                accessibilityHint="Opens profile view for this user"
              >
                <View style={styles.imageWrap}>
                  <AppImage
                    source={photoUrl}
                    style={styles.resultCardImage}
                    accessibilityLabel={`Profile photo of ${r.name}`}
                    accessibilityRole="image"
                    priority="normal"
                  />
                </View>
                <View style={[styles.resultCardFooter, { backgroundColor: '#ffffff' }]}>
                  <Text
                    style={[styles.resultCardName, { color: '#000000' }]}
                    allowFontScaling={true}
                    accessible={false}
                    importantForAccessibility="no"
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {!loading && results.length === 0 && !error && (
          <Text
            style={[styles.noResults, { color: colors.subtitle }]}
            accessible={true}
            accessibilityRole="text"
            allowFontScaling={true}
          >
            No results yet.
          </Text>
        )}
      </ScrollView>

      <PurchaseOptionsModal
        visible={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        initialFeature="search"
        userSummary={userSummary}
        paymentFlags={paymentFlags}
        onPurchased={async () => {
          setShowPurchaseModal(false);
          if (isAuthenticated) {
            await refreshSessionData();
          }
          // Unauthenticated: canUseSearch() now returns true, just close the modal
        }}
      />

      {/* Exit confirmation modal */}
      <Modal
        visible={showExitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.modalCenter}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.subtitle }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Leave Search?
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.subtitle }]}>
              Your search results will be lost if you leave this screen.
            </Text>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.accent }]}
              onPress={() => setShowExitModal(false)}
              accessible={true}
              accessibilityLabel="Stay on search"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalBtnText, { color: colors.buttonText }]}>
                Stay
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtnOutline, { borderColor: colors.text }]}
              onPress={confirmExit}
              accessible={true}
              accessibilityLabel="Leave search"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalBtnOutlineText, { color: colors.text }]}>
                Leave
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },

  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
  },

  title: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },

  input: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },

  searchBtn: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  searchText: { fontSize: 18, fontWeight: "600" },

  loadingWrap: { marginTop: 20, alignItems: "center" },
  loadingText: { marginTop: 10 },

  results: { flex: 1 },
  resultsContent: {
    paddingBottom: 20,
  },

  resultsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },

  resultCard: {
    width: "48%",
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
  },
  cardShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  imageWrap: {
    flex: 1,
    width: "100%",
  },

  resultCardImage: {
    width: "100%",
    height: "100%",
  },

  resultCardFooter: {
    height: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
  },

  resultCardName: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  noResults: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
  },

  // Modal styles - matching onboarding modal design
  modalCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },

  modalBox: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
  },

  modalSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 20,
  },

  modalBtn: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },

  modalBtnText: {
    fontWeight: "700",
    textAlign: "center",
    fontSize: 16,
  },

  modalBtnOutline: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },

  modalBtnOutlineText: {
    fontWeight: "600",
    textAlign: "center",
    fontSize: 16,
  },
});
