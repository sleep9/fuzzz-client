#ifndef EQUIX_WRAPPER_H
#define EQUIX_WRAPPER_H

#include <stdint.h>
#include <stddef.h>
#include <equix.h>

#ifdef __cplusplus
extern "C" {
#endif

int equix_init(void);
int equix_init_verify(void);

int equix_solve_wrapper(
    const uint8_t *challenge,
    size_t challenge_len,
    equix_solution * solutions
);

int equix_verify_wrapper(
    const uint8_t* challenge,
    size_t challenge_len,
    const equix_solution* solution
);

void equix_shutdown(void);

#ifdef __cplusplus
}
#endif

#endif