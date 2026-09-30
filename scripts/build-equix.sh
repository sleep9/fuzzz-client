#!/bin/bash

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

rm -rf "$ROOT/build/equix"

mkdir -p "$ROOT/build/equix"

echo "=== Building Equi-X + HashX ==="

cd "$ROOT/build/equix"

emcmake cmake "$ROOT/native/equix" \
    -DCMAKE_BUILD_TYPE=Release

emmake make

echo "=== Linking WASM ==="

emcc \
    "$ROOT/build/equix/libequix.a" \
    "$ROOT/build/equix/hashx/libhashx.a" \
    -O0 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME=EquixModule \
    -s ENVIRONMENT=worker \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORTED_FUNCTIONS='[
        "_equix_init",
        "_equix_init_verify",
        "_equix_solve_wrapper",
        "_equix_verify_wrapper",
        "_equix_shutdown",
        "_malloc",
        "_free"
    ]' \
    -s EXPORTED_RUNTIME_METHODS='[
        "HEAPU8",
        "HEAPU16"
    ]' \
    -o "$ROOT/src/wasm/equix.js"

echo "=== Done ==="