#include <stddef.h>
int main(int argc __attribute__((unused)), char **argv __attribute__((unused))) { return 0; }
void crosscall2(void(*fn)(void*), void *a, int c, size_t ctxt);
size_t _cgo_wait_runtime_init_done(void);
void _cgo_release_context(size_t);
void _cgo_allocate(void *a __attribute__((unused)), int c __attribute__((unused))) { }
void _cgo_panic(void *a __attribute__((unused)), int c __attribute__((unused))) { }
void _cgo_reginit(void) { }
#line 1 "cgo-generated-wrappers"
