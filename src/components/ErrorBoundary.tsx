import React, { Component, ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error in dev mode only
    if (__DEV__) {
      console.error("ErrorBoundary caught:", error, errorInfo);
    }
  }

  handleRestart = () => {
    // Reset error state to retry render
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            We encountered an unexpected error. Please restart the app.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={this.handleRestart}
            accessibilityRole="button"
            accessibilityLabel="Restart app"
          >
            <Text style={styles.buttonText}>Restart App</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#a0a0a0",
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 24,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
