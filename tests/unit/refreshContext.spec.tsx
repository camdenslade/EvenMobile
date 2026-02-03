import React, { useEffect } from "react";
import { render, waitFor, act } from "@testing-library/react-native";
import { RefreshProvider, useGlobalRefresh } from "../../src/context/RefreshContext";

jest.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "user-1" } }),
}));

const mockRefreshSessionData = jest.fn().mockResolvedValue(undefined);
jest.mock("../../src/context/SessionDataContext", () => ({
  useSessionData: () => ({
    refreshSessionData: mockRefreshSessionData,
  }),
}));

describe("RefreshContext", () => {
  beforeEach(() => {
    mockRefreshSessionData.mockClear();
  });

  it("calls refreshSessionData and registered refreshers", async () => {
    const refresher = jest.fn().mockResolvedValue(undefined);

    const onReady = (ctx: ReturnType<typeof useGlobalRefresh>) => {
      ctx.registerRefresher(refresher);
      act(() => {
        ctx.refresh();
      });
    };

    const TestComponent = ({ onInit }: { onInit: typeof onReady }) => {
      const ctx = useGlobalRefresh();
      useEffect(() => {
        onInit(ctx);
      }, [ctx]);
      return null;
    };

    render(
      <RefreshProvider>
        <TestComponent onInit={onReady} />
      </RefreshProvider>
    );

    await waitFor(() => expect(mockRefreshSessionData).toHaveBeenCalledTimes(1));
    expect(refresher).toHaveBeenCalledTimes(1);
  });

  it("prevents concurrent refreshes", async () => {
    const slowRefresher = jest.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 50))
    );

    let ctxRef: ReturnType<typeof useGlobalRefresh> | null = null;
    const TestComponent = () => {
      const ctx = useGlobalRefresh();
      useEffect(() => {
        ctx.registerRefresher(slowRefresher);
        ctxRef = ctx;
      }, [ctx]);
      return null;
    };

    render(
      <RefreshProvider>
        <TestComponent />
      </RefreshProvider>
    );

    // Wait for ctxRef to be set
    await waitFor(() => expect(ctxRef).not.toBeNull());

    await Promise.all([
      act(async () => {
        await ctxRef!.refresh();
      }),
      act(async () => {
        await ctxRef!.refresh();
      }),
    ]);

    expect(slowRefresher).toHaveBeenCalledTimes(1);
  });
});
