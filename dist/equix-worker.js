(function() {
	//#region src/equix-solve.ts
	var Module = null;
	function serializeSolution(solution) {
		if (solution.length !== 8) throw new Error("Invalid Equi-X solution");
		const bytes = /* @__PURE__ */ new Uint8Array(16);
		const view = new DataView(bytes.buffer);
		for (let i = 0; i < 8; i++) view.setUint16(i * 2, solution[i], true);
		return bytes;
	}
	function uint64BE(bytes) {
		let value = 0n;
		for (let i = 0; i < 8; i++) value = value << 8n | BigInt(bytes[i]);
		return value;
	}
	async function initEquix(wasmBytes) {
		if (Module) return Module;
		const createModule = globalThis.EquixModule;
		if (!createModule) throw new Error("EquixModule was not loaded");
		Module = await createModule({ instantiateWasm: (imports, receiveInstance) => {
			WebAssembly.instantiate(wasmBytes, imports).then(({ instance }) => {
				receiveInstance(instance);
			}).catch((error) => {
				console.error("Equi-X WASM instantiation failed:", error);
			});
			return {};
		} });
		Module._equix_init();
		Module._equix_init_verify();
		console.log("Equi-X initialized");
		return Module;
	}
	async function equix_solve(pageHash, pub, expires, target) {
		if (!Module) throw new Error("Equi-X has not initialized yet");
		let nonce = 0;
		const encoder = new TextEncoder();
		const SOLUTION_SIZE = 16;
		const solutionsPtr = Module._malloc(SOLUTION_SIZE * 8);
		if (!solutionsPtr) throw new Error("Failed to allocate Equi-X solutions buffer");
		console.log("SOLUTIONS MALLOCED:", solutionsPtr);
		try {
			while (true) {
				console.log("nonce:", nonce);
				const pattern = `${pageHash}:${pub}:${expires}:${nonce}`;
				const challenge = encoder.encode(pattern);
				console.log("challenge:", pattern);
				const challengePtr = Module._malloc(challenge.length);
				if (!challengePtr) throw new Error("Failed to allocate challenge buffer");
				try {
					Module.HEAPU8.set(challenge, challengePtr);
					const numSolutions = Module._equix_solve_wrapper(challengePtr, challenge.length, solutionsPtr);
					console.log("numSolutions:", numSolutions);
					if (numSolutions < 0) throw new Error(`Equi-X returned error: ${numSolutions}`);
					if (numSolutions === 0) {
						nonce++;
						continue;
					}
					for (let i = 0; i < numSolutions; i++) {
						const solutionPtr = solutionsPtr + i * SOLUTION_SIZE;
						const solution = [
							0,
							0,
							0,
							0,
							0,
							0,
							0,
							0
						];
						for (let j = 0; j < 8; j++) solution[j] = Module.HEAPU16[(solutionPtr >> 1) + j];
						console.log("EQUI-X SOLUTION:", solution);
						const solutionBytes = serializeSolution(solution);
						const input = new Uint8Array(challenge.length + solutionBytes.length);
						input.set(challenge, 0);
						input.set(solutionBytes, challenge.length);
						const value = uint64BE(new Uint8Array(await crypto.subtle.digest("SHA-256", input)));
						console.log("value:", value.toString(), "target:", target.toString(), "accepted:", value <= target);
						if (value > target) continue;
						const checkSolutionPtr = Module._malloc(16);
						if (!checkSolutionPtr) throw new Error("Failed to allocate verification buffer");
						try {
							Module.HEAPU8.set(Module.HEAPU8.slice(solutionPtr, solutionPtr + 16), checkSolutionPtr);
							const verifyResult = Module._equix_verify_wrapper(challengePtr, challenge.length, checkSolutionPtr);
							console.log("VERIFY:", verifyResult, "solution:", solution);
							if (verifyResult !== 0) {
								console.warn("Solver produced a solution that failed verification:", verifyResult);
								continue;
							}
							console.log("VALID PROOF FOUND", {
								nonce,
								pattern,
								solution
							});
							return {
								pattern,
								solution
							};
						} finally {
							Module._free(checkSolutionPtr);
						}
					}
					nonce++;
				} finally {
					Module._free(challengePtr);
				}
			}
		} finally {
			Module._free(solutionsPtr);
			console.log("SOLUTIONS FREED:", solutionsPtr);
		}
	}
	console.log(equix_solve);
	//#endregion
	//#region src/equix-worker.js
	self.onmessage = async (event) => {
		if (event.data.import) {
			importScripts(event.data.import);
			const equixReady = initEquix(event.data.wasmBytes);
			console.log("equix ready: ", equixReady);
			return;
		}
		const { id, pageHash, pub, expires, target } = event.data;
		try {
			const solution = await equix_solve(pageHash, pub, expires, BigInt(target));
			console.log("solution found*******: ", solution);
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
	//#endregion
})();
