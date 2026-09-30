// equix-worker.ts
import { initEquix, equix_solve } from "./equix-solve";


self.onmessage = async (event) => {

    if (event.data.import) {
        importScripts(event.data.import); // works — same-origin blob URL
        const equixReady = initEquix(event.data.wasmBytes);
        console.log('equix ready: ', equixReady)

        return;
    }

    const {
        id,
        pageHash,
        pub,
        expires,
        target
    } = event.data;


   
    try {

        
        const solution = await equix_solve(
            pageHash,
            pub,
            expires,
            BigInt(target)
        );

        console.log('solution found*******: ' ,solution)


        self.postMessage({
            id,
            ok: true,
            solution
        });

    } catch (error) {

        self.postMessage({
            id,
            ok: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
};