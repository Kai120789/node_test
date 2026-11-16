const REQUESTS = 10;
const MIB = 1024 * 1024;
const MBIT = 1_000_000;

function usage() {
  console.error("Usage: node speedtest.js <url>");
  console.error("Example: node speedtest.js https://speed.cloudflare.com/__down?bytes=5000000");
  process.exit(1);
}

function formatMiB(bytes) {
  return `${(bytes / MIB).toFixed(2)} MiB`;
}

function describeError(err) {
  const cause = err && err.cause;
  if (cause && cause.message && cause.message !== err.message) {
    return `${err.message}: ${cause.message}`;
  }
  return err && err.message ? err.message : String(err);
}

async function downloadOnce(url) {
  const started = performance.now();
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "Cache-Control": "no-cache" },
  });

  if (!response.ok) {
    await response.arrayBuffer();
    const error = new Error(`HTTP ${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  const body = Buffer.from(await response.arrayBuffer());
  const elapsedMs = performance.now() - started;

  return { bytes: body.length, elapsedMs, status: response.status };
}

async function main() {
  const url = process.argv[2];
  if (!url) usage();

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    console.error(`Not a valid URL: ${url}`);
    usage();
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    console.error(`Only http and https are supported, got: ${parsed.protocol}`);
    process.exit(1);
  }

  console.log(`URL:      ${url}`);
  console.log(`Requests: ${REQUESTS}, one after another`);
  console.log("");

  let totalBytes = 0;
  let totalMs = 0;

  for (let i = 1; i <= REQUESTS; i++) {
    let result;
    try {
      result = await downloadOnce(url);
    } catch (err) {
      console.error(`Request ${i} failed: ${describeError(err)}`);
      process.exit(1);
    }

    totalBytes += result.bytes;
    totalMs += result.elapsedMs;

    const index = String(i).padStart(2, " ");
    const time = `${result.elapsedMs.toFixed(0)} ms`.padStart(8, " ");
    console.log(`  ${index}  HTTP ${result.status}  ${formatMiB(result.bytes).padStart(12, " ")}  ${time}`);
  }

  const averageMs = totalMs / REQUESTS;
  const totalSeconds = totalMs / 1000;
  const speedMbit = (totalBytes * 8) / totalSeconds / MBIT;

  console.log("");
  console.log(`Average request time: ${averageMs.toFixed(0)} ms`);
  console.log(`Total downloaded:     ${formatMiB(totalBytes)} (${totalBytes} bytes)`);
  console.log(`Download speed:       ${speedMbit.toFixed(2)} Mbit/s`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
