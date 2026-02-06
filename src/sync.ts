export interface VersionResponse {
  version: string;
}

export interface Bundle {
  version: string;
  opencode: Record<string, unknown>;
  ohMyOpencode: Record<string, unknown> | null;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function retryFetch<T>(
  fetcher: () => Promise<T>,
  maxRetries: number = 2
): Promise<T | null> {
  const delays = [1000, 2000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetcher();
    } catch (error) {
      if (attempt === maxRetries) {
        return null;
      }
      const delay = delays[attempt] || 2000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
}

export async function checkVersion(
  dashboardUrl: string,
  token: string
): Promise<VersionResponse | null> {
  return retryFetch(async () => {
    const url = `${dashboardUrl}/api/config-sync/version`;
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      5000
    );

    if (!response.ok) {
      if (response.status === 401) {
        console.error(
          "[cliproxyapi-sync] Invalid or revoked sync token (401)"
        );
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as VersionResponse;
  });
}

export async function fetchBundle(
  dashboardUrl: string,
  token: string
): Promise<Bundle | null> {
  return retryFetch(async () => {
    const url = `${dashboardUrl}/api/config-sync/bundle`;
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      10000
    );

    if (!response.ok) {
      if (response.status === 401) {
        console.error(
          "[cliproxyapi-sync] Invalid or revoked sync token (401)"
        );
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as Bundle;
  });
}
