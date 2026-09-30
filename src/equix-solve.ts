let Module: any = null;


type EquixSolution = [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
];

function serializeSolution(solution: EquixSolution): Uint8Array {
    if (solution.length !== 8) {
        throw new Error("Invalid Equi-X solution");
    }

    const bytes = new Uint8Array(16);
    const view = new DataView(bytes.buffer);

    for (let i = 0; i < 8; i++) {
        view.setUint16(i * 2, solution[i], true);
    }

    return bytes;
}

function uint64BE(bytes: Uint8Array): bigint {
    let value = 0n;

    for (let i = 0; i < 8; i++) {
        value =
            (value << 8n) |
            BigInt(bytes[i]);
    }

    return value;
}




export async function initEquix(wasmBytes:ArrayBuffer) {

    if (Module) {
        return Module;
    }

    const createModule = (globalThis as any).EquixModule;

    if (!createModule) {
        throw new Error("EquixModule was not loaded");
    }

    
    Module = await createModule({

        instantiateWasm: (
            imports: WebAssembly.Imports,
            receiveInstance: (
                instance: WebAssembly.Instance
            ) => void
        ) => {

            WebAssembly.instantiate(
                wasmBytes,
                imports
            ).then(({ instance }) => {

                receiveInstance(instance);

            }).catch((error) => {

                console.error(
                    "Equi-X WASM instantiation failed:",
                    error
                );

            });

            // Emscripten expects this hook to return
            // the exports object synchronously if available.
            // For async instantiation, returning {} is valid.
            return {};
        }
    });

    Module._equix_init();
    Module._equix_init_verify();

    console.log("Equi-X initialized");


    
    return Module;
}

export async function equix_solve(
    pageHash: string,
    pub: string,
    expires: number,
    target:bigint
) {
    if (!Module) {
        throw new Error("Equi-X has not initialized yet");
    }

    let nonce = 0;

    const encoder = new TextEncoder();

    const SOLUTION_SIZE = 16;
    const MAX_SOLUTIONS = 8;

    const solutionsPtr = Module._malloc(
        SOLUTION_SIZE * MAX_SOLUTIONS
    );

    if (!solutionsPtr) {
        throw new Error(
            "Failed to allocate Equi-X solutions buffer"
        );
    }

    console.log(
        "SOLUTIONS MALLOCED:",
        solutionsPtr
    );

    try {
        while (true) {

            console.log(
                "nonce:",
                nonce
            );

            const pattern =
                `${pageHash}:${pub}:${expires}:${nonce}`;

            const challenge =
                encoder.encode(pattern);

            console.log(
                "challenge:",
                pattern
            );

            const challengePtr =
                Module._malloc(
                    challenge.length
                );

            if (!challengePtr) {
                throw new Error(
                    "Failed to allocate challenge buffer"
                );
            }

            try {

                /*
                 * Copy challenge into WASM memory.
                 */
                Module.HEAPU8.set(
                    challenge,
                    challengePtr
                );

                /*
                 * Run Equi-X solver.
                 */
                const numSolutions =
                    Module._equix_solve_wrapper(
                        challengePtr,
                        challenge.length,
                        solutionsPtr
                    );

                console.log(
                    "numSolutions:",
                    numSolutions
                );

                if (numSolutions < 0) {
                    throw new Error(
                        `Equi-X returned error: ${numSolutions}`
                    );
                }

                if (numSolutions === 0) {
                    nonce++;
                    continue;
                }

                /*
                 * Read each solution directly from
                 * the WASM HEAP.
                 */
                for (
                    let i = 0;
                    i < numSolutions;
                    i++
                ) {

                    const solutionPtr =
                        solutionsPtr +
                        i * SOLUTION_SIZE;

                    /*
                     * Read the 8 uint16 values individually.
                     */
                    const solution: EquixSolution = [
                        0, 0, 0, 0, 0, 0, 0, 0
                    ];
                    for (let j = 0; j < 8; j++) {
                        solution[j] =
                            Module.HEAPU16[(solutionPtr >> 1) + j];
                    }

                    console.log(
                        "EQUI-X SOLUTION:",
                        solution
                    );

                    /*
                     * Additional SHA-256 effort check.
                     */
                    const solutionBytes =
                        serializeSolution(solution);

                    const input =
                        new Uint8Array(
                            challenge.length +
                            solutionBytes.length
                        );

                    input.set(
                        challenge,
                        0
                    );

                    input.set(
                        solutionBytes,
                        challenge.length
                    );

                    const hash =
                        new Uint8Array(
                            await crypto.subtle.digest(
                                "SHA-256",
                                input
                            )
                        );

                    const value =
                        uint64BE(hash);

                    console.log(
                        "value:",
                        value.toString(),
                        "target:",
                        target.toString(),
                        "accepted:",
                        value <= target
                    );


                    if (value > target) {
                        continue;
                    }

                    /*
                     * The additional SHA-256 requirement
                     * passed.
                     *
                     * Now verify the EXACT 16 bytes that
                     * Equi-X produced.
                     */
                    const checkSolutionPtr =
                        Module._malloc(16);

                    if (!checkSolutionPtr) {
                        throw new Error(
                            "Failed to allocate verification buffer"
                        );
                    }

                    try {

                        /*
                         * Copy the raw 16 bytes directly.
                         *
                         * This preserves the exact memory
                         * representation produced by C.
                         */
                        Module.HEAPU8.set(
                            Module.HEAPU8.slice(
                                solutionPtr,
                                solutionPtr + 16
                            ),
                            checkSolutionPtr
                        );

                        const verifyResult =
                            Module._equix_verify_wrapper(
                                challengePtr,
                                challenge.length,
                                checkSolutionPtr
                            );

                        console.log(
                            "VERIFY:",
                            verifyResult,
                            "solution:",
                            solution
                        );

                        /*
                         * EQUIX_OK == 0
                         */

                        
                        if (verifyResult !== 0) {
                            console.warn(
                                "Solver produced a solution that failed verification:",
                                verifyResult
                            );

                            continue;
                            
                        }

                        console.log(
                            "VALID PROOF FOUND",
                            {
                                nonce,
                                pattern,
                                solution
                            }
                        );

                        return {
                            pattern,
                            solution
                        };

                    } finally {

                        Module._free(
                            checkSolutionPtr
                        );
                    }
                }

                /*
                 * None of the solutions passed the
                 * additional SHA-256 target.
                 */
                nonce++;

            } finally {

                Module._free(
                    challengePtr
                );
            }
        }

    } finally {

        Module._free(
            solutionsPtr
        );

        console.log(
            "SOLUTIONS FREED:",
            solutionsPtr
        );
    }
}


console.log(equix_solve);