import { runIdPhotoConsistencyBenchmark } from "../../src/lib/benchmarks/id-photo-consistency";

runIdPhotoConsistencyBenchmark(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "UNKNOWN_BENCHMARK_ERROR";
  console.error(`Benchmark failed: ${message}`);
  process.exitCode = 1;
});
