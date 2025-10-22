# Integration Guide

How to integrate the CORS proxy with PondPilot and other applications.

## 🔗 PondPilot Integration

This guide shows how to configure PondPilot to use the CORS proxy.

### Configuration Options

PondPilot supports three modes:

1. **Official Proxy** (default): `https://cors-proxy.pondpilot.io`
2. **Custom Proxy**: Self-hosted or third-party
3. **Direct** (no proxy): Only works for resources with CORS headers

### Settings UI

Add to PondPilot settings:

```typescript
// src/store/settingsStore.ts
interface Settings {
  corsProxy: {
    enabled: boolean;
    mode: 'official' | 'custom' | 'direct';
    customUrl?: string;
  };
}

const defaultSettings: Settings = {
  corsProxy: {
    enabled: true,
    mode: 'official',
    customUrl: undefined,
  },
};
```

### Implementation

#### 1. Detect CORS Errors

```typescript
// src/utils/fetchWithCorsProxy.ts
export async function fetchWithCorsProxy(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const settings = useSettingsStore.getState();

  if (!settings.corsProxy.enabled || settings.corsProxy.mode === 'direct') {
    // Direct fetch, no proxy
    return fetch(url, options);
  }

  // Build proxy URL
  const proxyUrl = getProxyUrl(settings.corsProxy);
  const proxiedUrl = `${proxyUrl}/proxy?url=${encodeURIComponent(url)}`;

  try {
    return await fetch(proxiedUrl, {
      ...options,
      mode: 'cors',
      credentials: 'omit', // Never send credentials through proxy
    });
  } catch (error) {
    console.error('Proxy fetch failed:', error);
    throw error;
  }
}

function getProxyUrl(config: Settings['corsProxy']): string {
  if (config.mode === 'custom' && config.customUrl) {
    return config.customUrl.replace(/\/$/, ''); // Remove trailing slash
  }
  return 'https://cors-proxy.pondpilot.io';
}
```

#### 2. Update DuckDB File Loading

```typescript
// src/controllers/duckdb/fileLoader.ts
import { fetchWithCorsProxy } from '@/utils/fetchWithCorsProxy';

export async function loadRemoteFile(url: string): Promise<void> {
  try {
    // Try direct fetch first
    const response = await fetch(url);
    if (response.ok) {
      return handleResponse(response);
    }
  } catch (error) {
    if (isCorsError(error)) {
      // Retry with proxy
      const response = await fetchWithCorsProxy(url);
      return handleResponse(response);
    }
    throw error;
  }
}

function isCorsError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    return message.includes('cors') ||
           message.includes('network') ||
           message.includes('failed to fetch');
  }
  return false;
}
```

#### 3. Settings UI Component

```tsx
// src/components/Settings/CorsProxySettings.tsx
import { useSettingsStore } from '@/store/settingsStore';

export function CorsProxySettings() {
  const { corsProxy, updateCorsProxy } = useSettingsStore();

  return (
    <div>
      <h3>CORS Proxy</h3>

      <Switch
        label="Enable CORS Proxy"
        checked={corsProxy.enabled}
        onChange={(enabled) => updateCorsProxy({ enabled })}
        description="Allows access to remote files without CORS headers"
      />

      {corsProxy.enabled && (
        <>
          <RadioGroup
            label="Proxy Mode"
            value={corsProxy.mode}
            onChange={(mode) => updateCorsProxy({ mode })}
          >
            <Radio value="official">
              Official (cors-proxy.pondpilot.io)
              <Text size="xs" c="dimmed">
                Free, no setup required, privacy-focused
              </Text>
            </Radio>
            <Radio value="custom">
              Custom Proxy
              <Text size="xs" c="dimmed">
                Use your own self-hosted proxy
              </Text>
            </Radio>
            <Radio value="direct">
              Direct (No Proxy)
              <Text size="xs" c="dimmed">
                Only works with CORS-enabled resources
              </Text>
            </Radio>
          </RadioGroup>

          {corsProxy.mode === 'custom' && (
            <TextInput
              label="Custom Proxy URL"
              placeholder="https://cors-proxy.yourdomain.com"
              value={corsProxy.customUrl || ''}
              onChange={(e) => updateCorsProxy({ customUrl: e.target.value })}
              description="Your self-hosted CORS proxy endpoint"
            />
          )}
        </>
      )}

      <Alert color="blue" mt="md">
        <Text size="sm">
          The CORS proxy enables PondPilot to access remote databases and files
          that don't have CORS headers configured. No data is logged or stored.
        </Text>
        <Anchor href="https://github.com/yourusername/cors-proxy" target="_blank" size="sm">
          Learn more about privacy →
        </Anchor>
      </Alert>
    </div>
  );
}
```

#### 4. First-Time Setup Flow

```tsx
// src/components/Onboarding/CorsProxyOnboarding.tsx
export function CorsProxyOnboarding() {
  return (
    <Modal opened onClose={handleClose}>
      <Title order={3}>CORS Proxy Setup</Title>

      <Text mt="md">
        PondPilot needs a CORS proxy to access remote databases that don't
        have CORS headers configured.
      </Text>

      <Text mt="md">Choose an option:</Text>

      <Stack mt="md">
        <Card withBorder padding="lg">
          <Title order={4}>Official Proxy (Recommended)</Title>
          <Text size="sm" c="dimmed">
            Free, maintained by PondPilot, no setup required
          </Text>
          <List size="sm" mt="xs">
            <List.Item>✅ No logging or tracking</List.Item>
            <List.Item>✅ Open source and auditable</List.Item>
            <List.Item>✅ Global edge network</List.Item>
          </List>
          <Button mt="md" onClick={() => selectMode('official')}>
            Use Official Proxy
          </Button>
        </Card>

        <Card withBorder padding="lg">
          <Title order={4}>Self-Hosted Proxy</Title>
          <Text size="sm" c="dimmed">
            Maximum privacy, requires setup
          </Text>
          <List size="sm" mt="xs">
            <List.Item>✅ Complete control</List.Item>
            <List.Item>✅ Runs on your infrastructure</List.Item>
            <List.Item>✅ Easy Docker deployment</List.Item>
          </List>
          <Button variant="outline" mt="md" onClick={() => selectMode('custom')}>
            Configure Self-Hosted
          </Button>
        </Card>

        <Card withBorder padding="lg">
          <Title order={4}>No Proxy</Title>
          <Text size="sm" c="dimmed">
            Only works with CORS-enabled resources
          </Text>
          <Button variant="subtle" mt="md" onClick={() => selectMode('direct')}>
            Continue Without Proxy
          </Button>
        </Card>
      </Stack>
    </Modal>
  );
}
```

## 📊 Usage Examples

### Basic Proxy Request

```typescript
// Proxy a CSV file
const response = await fetchWithCorsProxy(
  'https://example.com/data.csv'
);
const csv = await response.text();
```

### DuckDB ATTACH with Proxy

```typescript
// Before (fails with CORS error):
await conn.query(`
  ATTACH 's3://duckdb-blobs/databases/stations.duckdb' AS stations_db
`);

// After (with proxy):
const proxyUrl = 'https://cors-proxy.pondpilot.io';
const dbUrl = 'https://duckdb-blobs.s3.amazonaws.com/databases/stations.duckdb';
const proxiedUrl = `${proxyUrl}/proxy?url=${encodeURIComponent(dbUrl)}`;

await conn.query(`
  ATTACH '${proxiedUrl}' AS stations_db
`);
```

### Error Handling

```typescript
async function loadDatabase(url: string) {
  try {
    // Try direct first
    return await loadDirect(url);
  } catch (error) {
    if (isCorsError(error)) {
      // Show user-friendly message
      showNotification({
        title: 'CORS Error Detected',
        message: 'Retrying with CORS proxy...',
        color: 'blue',
      });

      // Retry with proxy
      return await loadWithProxy(url);
    }
    throw error;
  }
}
```

## 🧪 Testing

### Test Proxy Connection

```typescript
// src/utils/testCorsProxy.ts
export async function testCorsProxy(proxyUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${proxyUrl}/health`, {
      method: 'GET',
      mode: 'cors',
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}
```

### Settings Validation

```typescript
// Validate custom proxy URL
async function validateCustomProxy(url: string): Promise<string | null> {
  try {
    new URL(url);
  } catch {
    return 'Invalid URL format';
  }

  const isHealthy = await testCorsProxy(url);
  if (!isHealthy) {
    return 'Proxy is not responding or unhealthy';
  }

  return null; // Valid
}
```

## 📱 User Communication

### Privacy Notice

Show when first enabling proxy:

```
**Privacy Notice**

The CORS proxy enables access to remote files without CORS headers.

✅ No data logging or tracking
✅ Requests are forwarded transparently
✅ Open source and auditable

You can self-host for maximum privacy or use the official proxy.

[Learn more] [Privacy Policy]
```

### Status Indicator

```tsx
// Show proxy status in UI
<Badge color={corsProxy.enabled ? 'green' : 'gray'}>
  {corsProxy.enabled
    ? `Proxy: ${corsProxy.mode}`
    : 'Direct connection'
  }
</Badge>
```

## 🔧 Advanced Configuration

### Custom Headers

```typescript
// Add custom headers to proxy requests
const response = await fetch(proxiedUrl, {
  headers: {
    'X-Custom-Header': 'value',
  },
});
```

### Retry Logic

```typescript
async function fetchWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchWithCorsProxy(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
}
```

## 🚀 Deployment Checklist

- [ ] Add proxy settings to settings store
- [ ] Implement `fetchWithCorsProxy` utility
- [ ] Update file loading to use proxy
- [ ] Add settings UI component
- [ ] Implement error handling and retry logic
- [ ] Add onboarding flow
- [ ] Add proxy status indicator
- [ ] Update documentation
- [ ] Test with real CORS-blocked resources
- [ ] Add telemetry (optional, privacy-preserving)

## 📚 Additional Resources

- [Main README](./README.md)
- [Security Policy](./SECURITY.md)
- [Cloudflare Worker Setup](./cloudflare-worker/README.md)
- [Self-Hosted Setup](./self-hosted/README.md)
