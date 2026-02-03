import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import SearchScreen from "../../src/screens/profile/SearchScreen";

jest.useFakeTimers();

const mockApiGet = jest.fn();

jest.mock("../../src/services/apiService", () => ({
  apiGet: (...args: any[]) => mockApiGet(...args),
}));

jest.mock("../../src/context/ThemeProvider", () => ({
  useTheme: () => ({
    colors: {
      background: "#fff",
      text: "#000",
      card: "#eee",
      accent: "#f00",
      subtitle: "#999",
      buttonText: "#fff",
    },
  }),
}));

jest.mock("../../src/components/GlobalBackground", () => () => null);

const navigationMock = { goBack: jest.fn(), navigate: jest.fn() };

describe("SearchScreen", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("shows validation error for short queries", async () => {
    const { getByLabelText, getByText } = render(
      <SearchScreen navigation={navigationMock} />
    );

    const input = getByLabelText("Search name input");
    fireEvent.changeText(input, "a");

    const searchButton = getByLabelText("Search");
    fireEvent.press(searchButton);

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(getByText("Enter at least 2 characters.")).toBeTruthy();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("renders results and ratings on success", async () => {
    mockApiGet
      .mockResolvedValueOnce([
        {
          userUid: "u1",
          name: "John",
          age: 30,
          bio: "Hi",
          profileImageUrl: "https://img",
          distanceMiles: 5,
        },
      ])
      .mockResolvedValueOnce({ average: 4.5, count: 10 });

    const { getByLabelText, queryByText, getByText } = render(
      <SearchScreen navigation={navigationMock} />
    );

    fireEvent.changeText(getByLabelText("Search name input"), "John");
    fireEvent.press(getByLabelText("Search"));

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(queryByText("Search failed.")).toBeNull();
    expect(getByText("John, 30")).toBeTruthy();
    expect(getByText("5.0 miles away")).toBeTruthy();
    expect(getByText("Hi")).toBeTruthy();
  });

  it("shows error when search fails", async () => {
    mockApiGet.mockResolvedValueOnce(null);

    const { getByLabelText, getByText } = render(
      <SearchScreen navigation={navigationMock} />
    );

    fireEvent.changeText(getByLabelText("Search name input"), "Jo");
    fireEvent.press(getByLabelText("Search"));

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => expect(getByText("Search failed.")).toBeTruthy());
  });
});
