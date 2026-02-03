import { apiRequest } from "../../src/services/apiService";

describe("apiRequest", () => {
  const BASE_URL = "http://localhost:3000";

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL;
    jest.useRealTimers();
    global.fetch = jest.fn();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it("retries once on network failure then succeeds", async () => {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: () => Promise.resolve('{"ok":true}'),
      });

    const res = await apiRequest<{ ok: boolean }>("/health");
    expect(res).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(expect.stringContaining("/health"), expect.any(Object));
  });

  it("returns null on 401 authentication failure", async () => {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValue({
      status: 401,
      ok: false,
      text: () => Promise.resolve(""),
    });

    const res = await apiRequest("/secure");
    expect(res).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
