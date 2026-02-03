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

import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { AppImage } from "../../components/AppImage";

import Ionicons from "@expo/vector-icons/Ionicons";
import { apiGet } from "../../services/apiService";
import { useTheme } from "../../context/ThemeProvider";
import { useAuth } from "../../context/AuthContext";
import GlobalBackground from "../../components/GlobalBackground";
import { useSessionData } from "../../context/SessionDataContext";
import { PurchaseOptionsModal } from "../../components/PurchaseOptionsModal";
import { InlineAlert } from "../../components/InlineAlert";

const { width: screenWidth } = Dimensions.get("window");

interface SearchResult {
  userUid: string;
  name: string;
  age: number;
  bio: string;
  profileImageUrl: string | null;
  distanceMiles: number;
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
  const canUseSearch = () => {
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
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  //********************************************************************
  //
  // handleSearch Function
  //
  // Performs name search via /search endpoint and loads rating summaries
  // for each result. Clears previous results and errors before searching.
  //
  // Return Value
  // ------------
  // Promise<void>
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
  // data       SearchResult[]|null        Response from /search endpoint
  // summaries  Record<string,RatingSummary> Temporary ratings object
  // r          SearchResult               Current result in loop
  // summary    RatingSummary|null         Rating summary for result
  //
  //*******************************************************************
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

      if (!idToken) {
        setError("Missing auth token.");
        setLoading(false);
        return;
      }

      const data = await apiGet<SearchResult[]>(
        `/search/name?name=${encodeURIComponent(trimmed)}`,
        idToken,
      );

      if (!data) {
        setError("Search failed.");
        setLoading(false);
        return;
      }

      setResults(data);
      setLoading(false);
      refreshSessionData().catch(() => {});
    }, 250);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
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
        style={[styles.header, { color: colors.text }]}
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
            backgroundColor: colors.card,
            color: colors.text,
          },
        ]}
        placeholder="Enter name"
        placeholderTextColor={colors.subtitle}
        value={query}
        onChangeText={setQuery}
        accessible={true}
        accessibilityLabel="Search name input"
        accessibilityRole="none"
        accessibilityHint="Enter a name to search for profiles"
        allowFontScaling={true}
      />

      <TouchableOpacity
        style={[styles.searchBtn, { backgroundColor: colors.accent }]}
        onPress={handleSearch}
        accessible={true}
        accessibilityLabel="Search"
        accessibilityRole="button"
        accessibilityHint="Searches for profiles matching the entered name"
        accessibilityState={{ disabled: loading }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text 
          style={[styles.searchText, { color: colors.buttonText }]}
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

            return (
              <TouchableOpacity
                key={r.userUid}
                style={[
                  styles.resultCard,
                  styles.cardShadow,
                  { backgroundColor: '#ffffff', borderColor: '#e0e0e0' },
                ]}
                onPress={() =>
                  navigation.navigate("UserProfileView", {
                    userId: r.userUid,
                  })
                }
                accessible={true}
                accessibilityLabel={`${r.name}, age ${r.age}. Tap to view profile`}
                accessibilityRole="button"
                accessibilityHint="Opens profile view for this user"
              >
                <View style={styles.imageWrap}>
                  <AppImage
                    source={r.profileImageUrl ?? "https://via.placeholder.com/100"}
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
          await refreshSessionData();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },

  backButton: {
    position: "absolute",
    top: 45,
    left: 20,
    zIndex: 10,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },

  header: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 80,
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
    width: (screenWidth - 52) / 2,
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
});
