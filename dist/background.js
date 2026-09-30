//#region src/background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log("BACKGROUND RECEIVED:", request);
	if (request.action === "CLEARUSER") {
		(async () => {
			await chrome.storage.session.set({ keys: null });
		})();
		return true;
	}
	if (request.action === "STOREUSER") {
		(async () => {
			await chrome.storage.session.set({ keys: request.keys });
		})();
		return true;
	}
	if (request.action === "GETUSER") {
		console.log("GET USER CALLED");
		(async () => {
			console.log("GET USER CALLED IFFE");
			const keys = (await chrome.storage.session.get("keys")).keys;
			if (keys) console.log("Stored Gun identity:", keys);
			sendResponse({
				ok: true,
				keys
			});
		})();
		return true;
	}
	if (request.action === "resizeWindow") chrome.windows.getCurrent((window) => {
		chrome.windows.update(window.id, {
			width: request.width ?? window.width,
			height: request.height ?? window.height,
			state: "normal"
		});
	});
	if (request.action === "getEquixWasm") {
		(async () => {
			try {
				const url = chrome.runtime.getURL("wasm/equix.wasm");
				console.log("BACKGROUND WASM URL:", url);
				const response = await fetch(url);
				if (!response.ok) throw new Error(`WASM fetch failed: ${response.status}`);
				const buffer = await response.arrayBuffer();
				const bytes = new Uint8Array(buffer);
				console.log("BACKGROUND WASM SIZE:", bytes.length);
				sendResponse({
					ok: true,
					bytes: Array.from(bytes)
				});
			} catch (err) {
				console.error("WASM FETCH ERROR:", err);
				sendResponse({
					ok: false,
					error: String(err)
				});
			}
		})();
		return true;
	}
});
chrome.tabs.onActivated.addListener(async (activeInfo) => {
	console.log("TAB ACTIVATED");
	chrome.tabs.sendMessage(activeInfo.tabId, { action: "RESTOREUSER" });
});
//#endregion
