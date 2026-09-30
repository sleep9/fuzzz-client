#include <assert.h>

#include <stdbool.h>
#include <stdio.h>
#include "web.h"

static equix_ctx *ctx = NULL;
static equix_ctx *verify_ctx = NULL;

int equix_init(void) {
    ctx = equix_alloc(EQUIX_CTX_SOLVE);

    if (!ctx) {
        return 0;
    }

    return 1;
}

int equix_init_verify(void) {
    verify_ctx = equix_alloc(EQUIX_CTX_VERIFY);

    if(!verify_ctx) {
        return 0;
    }

    return 1;
}

int equix_solve_wrapper(
    const uint8_t *challenge,
    size_t challenge_len,
    equix_solution *solutions
) {
    int count = equix_solve(
        ctx,
        challenge,
        challenge_len,
        solutions
    );

    return count;
}

int equix_verify_wrapper(
    const uint8_t* challenge,
    size_t challenge_len,
    const equix_solution* solution
) {

    return equix_verify(verify_ctx, challenge, challenge_len, solution);
        
}

void equix_shutdown(void) {
    if (ctx) {
        equix_free(ctx);
        ctx = NULL;
    }

    if(verify_ctx) {
        equix_free(verify_ctx);
        verify_ctx = NULL;
    }
}