export interface EquixModule {
    _equix_init(): number;

    _equix_solve_wrapper(
        challengePtr: number,
        challengeLen: number,
        solutionsPtr: number
    ): number;

    _equix_shutdown(): void;

    _malloc(size: number): number;
    _free(ptr: number): void;

    HEAPU8: Uint8Array;
    HEAPU16: Uint16Array;
}

declare const createModule: () => Promise<EquixModule>;

export default createModule;