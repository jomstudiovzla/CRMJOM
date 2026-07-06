export function isCloudRuntime() {
  return Boolean(
    process.env.VERCEL ||
    process.env.VERCEL_URL ||
    process.env.RENDER ||
    process.env.RENDER_SERVICE_ID
  );
}

export function isLocalRuntime() {
  return !isCloudRuntime();
}

export function getLocalBaseUrl() {
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}