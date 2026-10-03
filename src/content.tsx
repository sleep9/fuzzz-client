import { createRoot } from "react-dom/client";
import Overlay from "./Overlay";
import { useState,useEffect,useRef } from "react";
import { XIcon } from "@phosphor-icons/react/dist/ssr";

import Gun from "gun";
import "gun/sea";
import canonicalize from "canonicalize";

import HStack from "./HStack";
import css from "./index.css?inline";
import { ArrowsOutCardinalIcon } from "@phosphor-icons/react";
import type { PostSchemaRequest,Drawing,Point,TextObject,TextObjectWithId,Stroke } from "./types";

const { SEA } = Gun;

let config: any = null;
let gun: any = null;
let user: any = null;
let mesh:any = null;

const powRequests = new Map<string, {
    resolve: (result:PowChallengeResponse) => void;
    reject: (err: Error) => void;
}>();

const gunReady = (async () => {
    const response = await fetch(
        chrome.runtime.getURL("config.json")
    );

    if (!response.ok) {
        throw new Error("Invalid config.json");
    }

    config = await response.json();

    gun = Gun({
        peers: config.peers,
        localStorage: false
    });

    mesh = (gun as any).back("opt.mesh");
    user = gun.user();
    
    const originalHear = mesh.hear;
    
    mesh.hear = function (raw: any, peer: any) {
    
        
        let parsed: any;
    
        try {
            if (typeof raw === "string") {
                parsed = JSON.parse(raw);
            } else if (
                raw !== null &&
                typeof raw === "object"
            ) {
                parsed = raw;
            } else {
                return;
            }
        } catch (error) {
            console.warn("Failed to parse mesh message:", error);
            return;
        }
    
        if (
            parsed &&
            typeof parsed === "object" &&
            parsed.dam === "fuzzz-pow" &&
            parsed.type === "challenge-pow-response"
        ) {
            const request = powRequests.get(parsed.id);
    
            if (request) {
                powRequests.delete(parsed.id);
                request.resolve(parsed);
                return;
            }
        }
        return originalHear.call(this, raw, peer);
    };
})();



const host = document.createElement("div");
document.documentElement.appendChild(host);

const shadow = host.attachShadow({
  mode: "closed"
});


function getEquixWasm(): Promise<ArrayBuffer> {

    return new Promise((resolve, reject) => {

        chrome.runtime.sendMessage(
            {
                action: "getEquixWasm"
            },
            (response) => {

                if (chrome.runtime.lastError) {
                    reject(
                        new Error(
                            chrome.runtime.lastError.message
                        )
                    );
                    return;
                }

                if (!response?.ok) {
                    reject(
                        new Error(
                            response?.error ??
                            "Failed to load Equi-X WASM"
                        )
                    );
                    return;
                }

                resolve(
                    new Uint8Array(response.bytes).buffer
                );
            }
        );
    });
}



const workerUrl = chrome.runtime.getURL('equix-worker.js');
const depUrl = chrome.runtime.getURL('wasm/equix.js');

let worker: Worker | null = null;

const workerBuild = async () =>{

    const [workerCode, depCode] = await Promise.all([
        fetch(workerUrl).then(r => r.text()),
        fetch(depUrl).then(r => r.text()),
    ]);
    
    const depBlobUrl = URL.createObjectURL(new Blob([depCode], { type: 'application/javascript' }));
    const workerBlobUrl = URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));
    
    worker = new Worker(workerBlobUrl);
    
    const wasmBytes = await getEquixWasm();

    worker.postMessage({ import: depBlobUrl, wasmBytes });

}

workerBuild();


const style = document.createElement("style");

const MAX_Z = 2147483647
style.textContent = css;

shadow.appendChild(style);

const pageCursorStyle = document.createElement("style");
document.head.appendChild(pageCursorStyle);

const rootElement = document.createElement("div");
rootElement.id = "root";

rootElement.style.position = "absolute";
rootElement.style.left = "0";
rootElement.style.top = "0";
rootElement.style.width = document.documentElement.scrollWidth + "px";
rootElement.style.height = document.documentElement.scrollHeight + "px";
rootElement.style.pointerEvents = "none";
rootElement.style.zIndex = "2147483647";
shadow.appendChild(rootElement);



function drawSmoothStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    color:string,
    normalizedAnchor:Point,
    anchor:Point,
    thickness:number
) {
    if (points.length === 0) return;

    const anchorX = normalizedAnchor.x * window.innerWidth;
    //const anchorY = anchor.y * window.innerHeight;

    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;

    if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(anchorX+points[0].x, anchor.y+points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        return;
    }

    ctx.beginPath();
    ctx.moveTo(anchorX+points[0].x, anchor.y+points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
        const midX = (anchorX+points[i].x + anchorX+points[i + 1].x) / 2;
        const midY = (anchor.y+points[i].y + anchor.y+points[i + 1].y) / 2;

        ctx.quadraticCurveTo(
            anchorX+points[i].x,
            anchor.y+points[i].y,
            midX,
            midY
        );
    }

    ctx.lineTo(
        anchorX+points[points.length - 1].x,
        anchor.y+points[points.length - 1].y
    );

    ctx.stroke();
}




function since(timestamp: number): string {
    const diff = Date.now() - timestamp;

    const minutes = Math.floor(diff / 60_000);

    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;

    return `${Math.floor(months / 12)}y ago`;
}

export interface UserIdentity {
    alias: string;
    pub: string;
    epub: string;
}

interface GunPost {
    document: string;
    _:any;
}

interface LoadedPost extends GunPost {
    sourcePublicKey: string;
}

interface TextDisplay {
    text:TextObject;
    visible:boolean;
    id:string;
    since:string;
}




type PowWorkerSolution = {
    solution: string;
    pattern:string;
};


type PowChallengeResponse = {
    id:string;
    dam:string;
    type:string;
    challenge:string;
    expires:number;
    bucket:string;
    difficulty:string;
}

type PowResult = PowChallengeResponse & PowWorkerSolution;

type ExtensionMessage = {
    action: string;
};

type EquixWorkerRequest = {
    pageHash: string;
    pub: string;
    expires: number;
    target: bigint;
};

type EquixWorkerResponse =
    | {
        id: string;
        ok: true;
        solution: PowWorkerSolution
    }
    | {
        id: string;
        ok: false;
        error: string;
    };
    
interface TextItemProps {
    id: string;
    since: string;
    menuActive: boolean;
    visibilityCallback: () => void;
    visible: boolean;
    location: Point;
    removeCallback: () => void;
    dragCallback: (e: React.PointerEvent) => void;
    zIndex: number;
    lines: string[];
    index: number;
    textObject: TextDisplay;
}

function TextItem({
    id,
    since,
    menuActive,
    visibilityCallback,
    visible,
    location,
    removeCallback,
    dragCallback,
    zIndex,
    lines,
    index,
    textObject
}: TextItemProps) {

    const rightAligned = location.x > window.innerWidth / 2;
    const moveToBottom = location.y < 40;

    return (
        <div
            key={index}
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: visible ? MAX_Z : zIndex,
            }}
        >

            {/* TEXT + MENU POSITIONING CONTAINER */}
            <div
                style={{
                    position: "absolute",
                    left: location.x,
                    top: location.y,
                    pointerEvents: "none",
                }}
            >

                {/* TEXT */}
                <div
                    className={
                        visible
                            ? rightAligned
                                ? "text-object-right visible"
                                : "text-object visible"
                            : rightAligned
                                ? "text-object-right"
                                : "text-object"
                    }
                    style={{
                        position: "relative",

                        transform: rightAligned
                            ? "translateX(-100%)"
                            : undefined,

                        pointerEvents: "auto",
                        userSelect: "text",

                        paddingBottom: 0,
                        paddingLeft: 8,
                        paddingRight: 8,
                        paddingTop: 2,

                        background: "white",

                        borderTopLeftRadius: rightAligned ? 12 : 0,
                        borderTopRightRadius: rightAligned ? 0 : 12,
                        borderBottomRightRadius: 12,
                        borderBottomLeftRadius: 12,

                        borderStyle: "solid",
                        borderWidth: 1,
                        borderColor: "#888888",

                        boxShadow:
                            "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                    }}
                >

                    {/* MENU */}
                    {menuActive && (
                        <HStack
                            gap={0}
                            className={
                                textObject.visible
                                    ? rightAligned
                                        ? "text-options-left visible"
                                        : "text-options visible"
                                    : rightAligned
                                        ? "text-options-left"
                                        : "text-options"
                            }
                            style={{
                                position: "absolute",

                                left: rightAligned ? "auto" : 0,
                                right: rightAligned ? 0 : "auto",

                                top: moveToBottom ? "100%" : 0,

                                transform: moveToBottom
                                    ? undefined
                                    : "translateY(-100%)",

                                pointerEvents: "auto",
                                userSelect: "text",
                                background: "clear",
                                padding: 4,
                                fontSize: 12,
                            }}
                        >

                            <div
                                className="text-button"
                                onClick={removeCallback}
                                style={{
                                    borderTopRightRadius: 0,
                                    borderBottomRightRadius: 0,
                                    width: 24,
                                    height: 24,
                                }}
                            >
                                <XIcon
                                    size={14}
                                    weight="bold"
                                />
                            </div>

                            <div
                                className="text-button"
                                onPointerDown={dragCallback}
                                style={{
                                    borderTopLeftRadius: 0,
                                    borderBottomLeftRadius: 0,
                                    borderLeft: "0px",
                                    width: 24,
                                    height: 24,
                                }}
                            >
                                <ArrowsOutCardinalIcon
                                    size={14}
                                    weight="bold"
                                />
                            </div>

                        </HStack>
                    )}

                    {/* TEXT CONTENT */}
                    {lines.map((line, i) => (
                        <div
                            key={i}
                            style={{
                                display: "table",
                                background: "white",
                                color: "black",
                                fontSize: 14,
                                paddingTop: "4px",
                                paddingBottom: "4px",
                                whiteSpace: "pre",
                                marginBottom: "-8px",
                            }}
                        >
                            {line || "\u00A0"}
                        </div>
                    ))}

                    <p
                        style={{
                            marginTop: 10,
                            fontFamily: "monospace",
                            fontSize: 10,
                            color: "#888",
                        }}
                    >
                        {since}{" "}
                        <span style={{ color: "black" }}>•</span> 0x{id}
                    </p>

                </div>

                {/* DOT */}
                <div
                    className={
                        visible
                            ? "text-dot toggled"
                            : "text-dot"
                    }
                    onClick={visibilityCallback}
                    style={{
                        position: "absolute",
                        left: rightAligned ? 0 : 0,
                        top: 0,
                        pointerEvents: "auto",
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        cursor: "pointer",
                    }}
                />

            </div>
        </div>
    );
}

function workerSolve(
    pageHash: string,
    pub: string,
    expires: number,
    target: bigint
): Promise<PowWorkerSolution> {
    return new Promise((resolve, reject) => {
        if (!worker) {
            reject(new Error("Worker is not initialized"));
            return;
        }

        const currentWorker = worker;

        const cleanup = () => {
            currentWorker.removeEventListener("message", onMessage);
            currentWorker.removeEventListener("error", onError);
        };

        const onMessage = (event: MessageEvent<EquixWorkerResponse>) => {
            cleanup();

            if (event.data.ok) {
                resolve(event.data.solution);
            } else {
                reject(new Error(event.data.error));
            }
        };

        const onError = (event: ErrorEvent) => {
            cleanup();
            reject(event.error ?? new Error(event.message));
        };

        currentWorker.addEventListener("message", onMessage);
        currentWorker.addEventListener("error", onError);

        currentWorker.postMessage({
            pageHash,
            pub,
            expires,
            target
        } satisfies EquixWorkerRequest);
    });
}








export default function App() {

    //const syncTimer = useRef<number | null>(null);
    const dirty = useRef(false);
    const uploading = useRef(false);
    const version = useRef(0);

    const restoringUser = useRef(false);
    
    async function restoreUser() {
    
        if (restoringUser.current) {
            return;
        }
    
        restoringUser.current = true;
    
        try {
            const response = await new Promise<any>((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { action: "GETUSER" },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                            return;
                        }
    
                        resolve(response);
                    }
                );
            });
    
            if (!response?.keys) {

              
                drawing.current.strokes = []
                texts.current = [];
                texts_display.current = [];
        
                user.leave();
                
                setLoggedIn(false);

                forceUpdate(v => v + 1);
        
                return;
            }
    
            await new Promise<void>((resolve, reject) => {
                user.auth(response.keys, (ack: any) => {
    
                    if (ack.err) {
                        reject(new Error(ack.err));
                        return;
                    }
                    setLoggedIn(true);
                    
                    resolve();
                });
            });
    
            forceUpdate(v => v + 1);
        
    
         
        } catch (err) {
            console.error("RESTORE USER FAILED:", err);
        } finally {
            restoringUser.current = false;
        }
    }
    
    useEffect(() => {
        const listener = (request: ExtensionMessage) => {
            if (request.action === "RESTOREUSER") {

                restoreUser();
            }
        };
    
        chrome.runtime.onMessage.addListener(listener);
    
        return () => {
            chrome.runtime.onMessage.removeListener(listener);
        };
    }, []);

    async function login(
        alias: string,
        password: string
      ):Promise<UserIdentity> {

        return new Promise((resolve, reject) => { 
            try { 
                user.auth(alias, password, (ack: any) => { 
                    if (ack.err) { 
                        reject(new Error(ack.err)); 
                    } else if (!user.is) { 
                        reject(new Error("Authentication succeeded but user.is is undefined.")); 
                    } else { 

                        chrome.runtime.sendMessage({
                            action: "STOREUSER",
                            keys:(user._ as any).sea

                        });

                        setLoggedIn(true); 
                        resolve(user.is as UserIdentity); 
                     } 
                    }); 
                } catch (e) { 
                    reject(
                        e instanceof Error
                            ? e
                            : new Error(String(e))
                    );
                } 
            });
    
    }

    async function logout(): Promise<void> {

        drawings.current = [];
        drawing.current.strokes = [];

        renderCanvas();

        texts.current = [];
        texts_display.current = [];

        other_texts.current = [];
        other_texts_display.current = [];

        
                 
        
        user.leave();

        chrome.runtime.sendMessage({
            action: "CLEARUSER",
        });



        setLoggedIn(false);

        forceUpdate(v => v + 1);
       
    }


    async function createUser(
        alias: string,
        password: string
      ): Promise<UserIdentity> {
        return new Promise((resolve, reject) => {
          user.create(alias, password, (ack: any) => {
            if (ack.err) {

              reject(new Error(ack.err));
              return;
            }
      
            user.auth(alias, password, (ack: any) => {
              if (ack.err) {

                reject(new Error(ack.err));
              } else if (!user.is) {

                reject(
                  new Error("User created but authentication failed.")
                );
              } else {

                setLoggedIn(true);

                chrome.runtime.sendMessage({
                    action: "STOREUSER",
                    keys:(user._ as any).sea

                });

                resolve(user.is as UserIdentity);
              }
            });
          });
        });
      }

      // Gun stores arrays as numeric-keyed objects.
      // Convert arrays to objects before canonicalization/signing.

      function arraysToObjects(value: any): any {
        if (Array.isArray(value)) {
            const out: Record<string, any> = {};
    
            value.forEach((v, i) => {
                out[i] = arraysToObjects(v);
            });
    
            return out;
        }
    
        if (value && typeof value === "object") {
            const out: Record<string, any> = {};
    
            for (const [k, v] of Object.entries(value)) {
                out[k] = arraysToObjects(v);
            }
    
            return out;
        }
    
        return value;
    }


    function requestPowChallenge(pageHash:string,pub:string):Promise<PowResult> {
        return new Promise((resolve, reject) => {
            const id = crypto.randomUUID();
    
            const timeout = setTimeout(() => {
                powRequests.delete(id);
                reject(new Error("PoW challenge timeout"));
                
            }, 5000);
    
            powRequests.set(id, {
                resolve: (response:PowChallengeResponse) => {
                    clearTimeout(timeout);
               
                    const target:bigint = BigInt(response.difficulty);

                    workerSolve(
                        pageHash,
                        pub,
                        response.expires,
                        target
                    )
                    .then((solution:PowWorkerSolution) => {
            
            
                        resolve({
                            ...response,
                            ...solution
                        });
            
                    })
                    .catch((error) => {
            
                        console.error("Equi-X worker failed:", error);
            
                        reject(error);
            
                    });
                    
                },
                reject
            });
    
           
    
            const msg = {
                dam: "fuzzz-pow",
                type: "challenge-pow-request",
                id
            }

            mesh.say(msg);
        });
    }

    async function sha256(text: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
      
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      
        return Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");
    }

    
    function decodePoints(value: unknown): Point[] {
        if (typeof value !== "string") {
            throw new Error("Invalid points encoding");
        }
    
        let binary: string;
    
        try {
            binary = atob(value);
        } catch {
            throw new Error("Invalid base64 points");
        }
    
        const buffer = new Uint8Array(binary.length);
    
        for (let i = 0; i < binary.length; i++) {
            buffer[i] = binary.charCodeAt(i);
        }
    
        if (buffer.length % 4 !== 0) {
            throw new Error("Invalid points length");
        }
    
        if (buffer.length / 4 > 1024) {
            throw new Error("Too many points");
        }
    
        const view = new DataView(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength
        );
    
        const points: Point[] = [];
    
        for (let i = 0; i < buffer.length; i += 4) {
            const x = view.getInt16(i, true) / 10;
            const y = view.getInt16(i + 2, true) / 10;
    
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                throw new Error("Invalid point");
            }
    
            points.push({ x, y });
        }
    
        return points;
    }

    function encodePoints(points: Point[]): string { // 2 bytes for X + 2 bytes for Y per point 
        const buffer = new ArrayBuffer(points.length * 4); 
        const view = new DataView(buffer); 
        for (let i = 0; i < points.length; i++) { 
            const offset = i * 4; 
            view.setInt16( 
                offset, 
                Math.round(points[i].x * 10), 
                true // little-endian 
            ); 
            view.setInt16( 
                offset + 2, 
                Math.round(points[i].y * 10), 
                true // little-endian 
            ); 
        } 
        const bytes = new Uint8Array(buffer); 
        let binary = ""; 
        for (const byte of bytes) { 
            binary += String.fromCharCode(byte); 
        } 
        return btoa(binary); 
    }

    async function sign(post: PostSchemaRequest): Promise<string> {
        if (!user.is) {
          throw new Error("Not authenticated");
        }
      
        const { _sig, ...unsignedPost } = post;

        
        const canonical = canonicalize(arraysToObjects(unsignedPost));

       

        if (canonical === undefined) {
            throw new Error("Failed to canonicalize document");
        }

        const encoded = btoa(unescape(encodeURIComponent(canonical)));

        //  const bytes = new TextEncoder().encode(encoded).length;
        const pair = (user._ as any).sea;

        if (!pair) {
            throw new Error("Not authenticated");
        }

        const sig = await SEA.sign(encoded, pair);
        
        return sig;
    }

    async function signIndex(post: any): Promise<string> {
        if (!user.is) {
          throw new Error("Not authenticated");
        }

        const { _sig, ...unsignedPost } = post;

        const canonical = canonicalize(unsignedPost);

        if (canonical === undefined) {
            throw new Error("Failed to canonicalize document");
        }

        const pair = (user._ as any).sea;

        if (!pair) {
            throw new Error("Not authenticated");
        }

        const sig = await SEA.sign(canonical, pair);
        
        return sig;
    }

    async function syncNow() {

        if (uploading.current || !dirty.current) return;
    
        uploading.current = true;
        dirty.current = false;
    
        const uploadVersion = version.current;
    
       
        try {

            const hash = await sha256(window.location.href);
    
            if (!user.is?.pub) {
                throw new Error("Not authenticated");
            }
        
            const post = createPostRequest(user.is.pub, hash);
        
            if (uploadVersion !== version.current) {
                return;
            }
    
            post._sig = await sign(post);
            delete post.payload;
    
            let response: PowResult = await requestPowChallenge(
                post._page,
                post._pub
            );
    
            post.pow = {
                solution: response.solution,
                pattern: response.pattern,
                challenge: response.challenge
            };

            const serialized = JSON.stringify(post);
    
            
            
            gun.user()
                .get("posts")
                .get(post._page)
                .put(
                    {
                        document: serialized
                    }
                );
    
                
            const postKey = `${post._pub}:${post._page}`;

           
            const indexedPost = {
                _protocol: {
                    version: 1
                  },
                _sig: "",
                url:window.location.href,
                challenge:response.challenge,
                _pub: post._pub,
            };

            indexedPost._sig = await signIndex(indexedPost);
            
            const indexDocument = JSON.stringify({
                _protocol: indexedPost._protocol,
                _sig: indexedPost._sig,
                _pub: indexedPost._pub,
            });

            
            const app = gun.get("@app");
            const all = app.get("all");
            const bucket = all.get(response.bucket);
            const postNode = bucket.get(postKey);
            
            postNode.put({
                document: indexDocument
            });


            gun.get("@app")
            .get(post._page)
            .get("posts")
            .get(post._pub)
            .put(true);

            
    
        } catch (error) {
       
        } finally {
              
            uploading.current = false;

            forceUpdate(v => v + 1);
    
            if (dirty.current) {
                queueMicrotask(() => syncNow());
            }
        }
    }

    function markDirty() {
        version.current++;
        dirty.current = true;
    
       
        syncNow()
    }

    const [lineThickness,setLineThickness] = useState<number>(2.0);
    const [loggedIn,setLoggedIn] = useState<boolean>(false);



    const draggingText = useRef<{
        text: TextDisplay;
        offsetX: number;
        offsetY: number;
        element:HTMLElement;
    } | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const currentStroke = useRef<Stroke>({
        points:[],
        color:'#000000',
        location:{x:0,y:0},
        normalizedLocation:{x:0,y:0},
        viewportWidth:1440,
        thickness:lineThickness
    });


    const [textOthersEnabled,setTextOthersEnabled] = useState(true);
    const [textOwnedEnabled,setTextOwnedEnabled] = useState<boolean>(true);

    const [drawingEnabled,setDrawingEnabled] = useState(false);

    const [drawingOwnedEnabled,setDrawingOwnedEnabled] = useState<boolean>(false);
    const [drawingOthersEnabled,setDrawingOthersEnabled] = useState<boolean>(false);

    const [addTextEnabled,setAddTextEnabled] = useState(false);

    const [displayText,setDisplayText] = useState<boolean>(true);
    const [displayDrawing,setDisplayDrawing] = useState<boolean>(false);

    const isDrawing = useRef(false);
    const [lineColor,setLineColor] = useState<string>("#000000");
    
    let totalPoints = 0;
    
    const drawing = useRef<{
        strokes: Stroke[];
    }>({
        strokes: []
    });

    
    const [pageIndex,setPageIndex] = useState<number>(1);
    const [paginationCount,setPaginationCount] = useState<number>(0);



    const POSTS_PER_PAGE = 3;

    const posts = useRef<LoadedPost[]>([])
   
    const drawings = useRef<Stroke[]>([])

    const texts = useRef<TextObject[]>([]);

    const texts_display = useRef<TextDisplay[]>([]);

    const other_texts = useRef<TextObjectWithId[]>([]);
    const other_texts_display = useRef<TextDisplay[]>([])
    
    const [url, setUrl] = useState<string>(
        () => window.location.href
    );
    useEffect(() => {
        let lastUrl = window.location.href;

        const interval = setInterval(() => {
            const currentUrl = window.location.href;

             if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                setUrl(currentUrl);
            }
        }, 250);

        return () => clearInterval(interval);
    }, []);


    function getPostDocumentSoul(page: string, pub: string): string {
        return `~${pub}/posts/${page}`;
    }


    function isSignedPost(value: unknown): value is {
        _sig: string;
        _pub: string;
    } {
        if (!value || typeof value !== "object") return false;
    
        const obj = value as Record<string, unknown>;
    
        return (
            typeof obj._sig === "string" &&
            typeof obj._pub === "string"
        );
    }

    async function verifySignature(
        doc: unknown
    ): Promise<string | null> {
        if (!isSignedPost(doc)) {
            return null;
        }
    
        try {
            return await SEA.verify(doc._sig, doc._pub) || null;
        } catch {
            return null;
        }
    }

    // Restore numeric-keyed Gun objects back into arrays after reading.

    function objectsToArrays(value: any): any{
        if (!value || typeof value !== "object") {
            return value;
        }
    
        const keys = Object.keys(value);
    
        const isArray =
            keys.length > 0 &&
            keys.every((k, i) => String(i) === k);
    
        if (isArray) {
            return keys
                .sort((a, b) => Number(a) - Number(b))
                .map(k => objectsToArrays(value[k]));
        }
    
        const out: Record<string, any> = {};
    
        for (const [k, v] of Object.entries(value)) {
            out[k] = objectsToArrays(v);
        }
    
        return out;
    }

    async function publicKeyId(pub: string): Promise<string> {
        const data = new TextEncoder().encode(pub);
    
        const hash = await crypto.subtle.digest("SHA-256", data);
    
        const bytes = new Uint8Array(hash);
    
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, "0"))
            .join("")
    }


    function isPost(value: unknown): value is PostSchemaRequest {
        if (typeof value !== "object" || value === null) {
            return false;
        }

        const post = value as Record<string, unknown>;

        if (typeof post._pub !== "string") {
            console.warn('post _pub not string');
            return false;
        }

        if (typeof post._sig !== "string") {

            console.warn('post _sig not string');
            return false;
        }

        if (typeof post._page !== "string") {

            console.warn('post _page not string');
            return false;
        }

        if (typeof post._protocol !== "object" || post._protocol === null) {

            console.warn('post protocol not object');
            return false;
        }

        if (typeof post.url !== "string" || !post.url) {
            return false;
        }

        if (post.url.length > 2048) {
            return false;
        }

        try {
            const url = new URL(post.url);

            if (
                url.protocol !== "http:" &&
                url.protocol !== "https:"
            ) {
                return false;
            }
        } catch {
            return false;
        }

        const protocol = post._protocol as Record<string, unknown>;

        if (typeof protocol.version !== "number") {

            console.warn('post protocol version not number');
            return false;
        }

        return true;

    }

    function isPoint(value: unknown): value is Point {
        if (typeof value !== "object" || value === null) {
            return false;
        }
    
        const point = value as Record<string, unknown>;
    
        return (
            typeof point.x === "number" &&
            typeof point.y === "number"
        );
    }
    
    function isTextObject(value: unknown): value is TextObject {

        if (typeof value !== "object" || value === null) {
            return false;
        }

        
    
        const text = value as Record<string, unknown>;
    
        const contentIsString = typeof text.content === "string"

        const contentLengthValid = (text.content as string).length <= 512;


        const locationIsPoint = isPoint(text.location);
        const normalizedLocationIsPoint = isPoint(text.normalizedLocation);

        const viewportWidthValid = typeof text.viewportWidth === "number";

        return (
            contentIsString &&
            contentLengthValid &&
            locationIsPoint &&
            normalizedLocationIsPoint &&
            viewportWidthValid
        );
    }
    
    function isStroke(value: unknown): value is Stroke {
        if (typeof value !== "object" || value === null) {
            return false;
        }
    
        const stroke = value as Record<string, unknown>;
    
        if (typeof stroke.points !== 'string') {
            return false;
        }
    
        if (typeof stroke.color !== "string") {
            return false;
        }
    
        if (!/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(stroke.color)) {
            return false;
        }
    
        if (
            stroke.thickness !== 1 &&
            stroke.thickness !== 2 &&
            stroke.thickness !== 3
        ) {
            return false;
        }
    
        return (
            typeof stroke.viewportWidth === "number" &&
            isPoint(stroke.location) &&
            isPoint(stroke.normalizedLocation)
        );
    }
    
    function isDrawingDocument(value: unknown): value is Drawing {
        if (typeof value !== "object" || value === null) {
            return false;
        }
    
        const drawing = value as Record<string, unknown>;
    
        return (
            Array.isArray(drawing.strokes) &&
            drawing.strokes.every(isStroke)
        );
    }
    
    function isDocument(value: unknown): value is any {
        if (typeof value !== "object" || value === null) {

            return false;
        }

    
        const document = value as Record<string, unknown>;
    

        const validTexts =
            document.texts === "stub" ||
            (
                Array.isArray(document.texts) &&
                document.texts.every(isTextObject)
            );
    
        const validDrawing =
            document.drawing === "stub" ||
            isDrawingDocument(document.drawing);
    
        return validTexts && validDrawing;
    }


    async function parseItem (item:any,sourcePublicKey:string,time:number) {



            let parsed:unknown;

            try {
                parsed = JSON.parse(item.document);
            } catch(err) {
                console.warn("Invalid parse: ", err);
                return;
            }

            if(!isPost(parsed)) { 
                console.warn("not a post");
               
                return;
            }
            let verified = await verifySignature(parsed) 

            if(!verified) {
                return;
            }

            let decoded: string;


            try {
                decoded = decodeURIComponent(escape(atob(verified)));
            } catch (err) {
                console.warn("Invalid encoded document:", err);
                return;
            }

            
            
            let document:unknown;

            try {
                document = JSON.parse(decoded);
            } catch(err) {
                console.warn("Invalid parse: ", err);
                return;
            }

            


            let post = objectsToArrays(document);


            if(!isDocument(post.payload)) { 
             
                console.warn("not a document");
                return;
            }

            if(post._pub !== sourcePublicKey) {
                return;
            } 
            
            
            if (post.payload?.drawing !== "stub" && post.payload?.drawing) {

                for (const stroke of post.payload.drawing.strokes) {
                    stroke.points = decodePoints(stroke.points);
                
                    drawings.current.push({
                        ...stroke,
                    });
                }

                renderCanvas();

                
            }

            if (post.payload?.texts !== "stub" && post.payload?.texts) {
                for (const textObject of post.payload.texts) {
            
                    

                    const keyid = await publicKeyId(sourcePublicKey);

                    const id = keyid.slice(0, 10) + "..." + keyid.slice(-10);

            
                    other_texts.current.push({
                        ...textObject,
                        id:id
                    });

                    const textDisplay: TextDisplay = {
                        text: textObject,
                        visible: false,
                        id,
                        since:since(time)
                    };
            
                    other_texts_display.current.push({
                        ...textDisplay
                    });
                }
            }

            forceUpdate(v => v + 1);


    }

    //const didMount = useRef(false);

    function renderCurrentPage() {


        drawings.current = [];

        other_texts.current = [];
        other_texts_display.current = [];


        let startIndex = (pageIndex-1) * POSTS_PER_PAGE;
        let endIndex = startIndex + POSTS_PER_PAGE;

        forceUpdate(v => v + 1);


        for(var j = startIndex; j<endIndex; j++) {

            if(j>=posts.current.length) continue;
            let item = posts.current[j];

            parseItem(item,item.sourcePublicKey,item._?.[">"]?.document);

            forceUpdate(v => v + 1);
        }

        renderCanvas();

    }

    useEffect(()=>{


        renderCurrentPage()

    },[pageIndex])

  
   
    useEffect(() => {
        if (url === '') return;

        drawing.current.strokes = []
        drawings.current = [];

        texts.current = [];
        texts_display.current = [];

        other_texts.current = [];
        other_texts_display.current = [];

        posts.current = [];

        const seenPosts = new Set<string>();

     
        
        if(user.is) {

              
            const our_pub = user.is.pub;
            sha256(url).then((page:string)=>{

                const our_soul = getPostDocumentSoul(page, our_pub);

                gun.get(our_soul).once(async (our_item:any) => {

                    // first get our texts regardless of paging

                    if (!our_item) return;

                   

                    let parsed:object;

                    try {
                        parsed = JSON.parse(our_item.document);
                    } catch(err) {
                        console.warn("Invalid parse: ", err);
                        return;
                    }

                    let verified = await verifySignature(parsed) 

                    if(!verified) {
                        return;
                    }

                    let decoded: string;


                    try {
                        decoded = decodeURIComponent(escape(atob(verified)));
                    } catch (err) {
                        console.warn("Invalid encoded document:", err);
                        return;
                    }

                    
                    
                    let document:any;

                    try {
                        document = JSON.parse(decoded);
                    } catch(err) {
                        console.warn("Invalid parse: ", err);
                        return;
                    }

                    let post = objectsToArrays(document);

                    
                    if(post._pub !== our_pub) {
                       return;
                    } 
                    
                    if (post.payload?.drawing !== "stub" && post.payload?.drawing) {


                        for (const stroke of post.payload.drawing.strokes) {
                            stroke.points = decodePoints(stroke.points);
                        
                            drawing.current.strokes.push({
                                ...stroke,
                            });
                        }

                        renderCanvas();

                        
                    }
                    
                    if (post.payload?.texts !== "stub" && post.payload?.texts) {
                        for (const textObject of post.payload.texts) {
                    
                            texts.current.push({
                                ...textObject,
                            });
                            const keyid = await publicKeyId(our_pub);

                            const id = keyid.slice(0, 10) +'...'+ keyid.slice(-10);

                            const textDisplay: TextDisplay = {
                                text: textObject,
                                visible: true,
                                id,
                                since:since(our_item._?.[">"]?.document)
                            };
                    
                            texts_display.current.push({
                                ...textDisplay
                            });
                        }
                    }

                    forceUpdate(v => v + 1);

                });

                let pending = 0;

                gun
                .get("@app")
                .get(page)
                .get("posts")
                .map()
                .once((value:any, pub:string) => {


                    

                    if (value === undefined) return;
                    if (typeof pub !== "string") return;

                    if(pub === our_pub) return;

                    const soul = getPostDocumentSoul(page, pub);

                    gun.get(soul).once(async (item:any) => {


                        if(item) {

                        const timestamp = item._?.[">"]?.document;

                        const postId = `${pub}:${timestamp}`;
            
                        if (timestamp && !seenPosts.has(postId)) {
            
                      
                     
                        seenPosts.add(postId);


                        posts.current.push({...item,sourcePublicKey:pub});
                        
                        pending++;


                        setPaginationCount(Math.ceil(posts.current.length / POSTS_PER_PAGE))
                        

                        if (pending >= POSTS_PER_PAGE) {
    
                            pending = 0;
                            posts.current.sort((a, b) => a._?.[">"]?.document - b._?.[">"]?.document);
                            
                       
                        }
                        

                        const index = posts.current.findIndex(
                            post =>
                                post.sourcePublicKey === pub &&
                                post._?.[">"]?.document === timestamp
                        );
            
                        const startIndex =
                            (pageIndex - 1) * POSTS_PER_PAGE;
            
                        const endIndex =
                            startIndex + POSTS_PER_PAGE;
            
                        if (index >= startIndex && index < endIndex) {
                            parseItem(
                                item,
                                pub,
                                timestamp
                            );
                        }

                        }
                    }
                        
                    }); 
                });
            })

        } else {

        sha256(url).then((page:string)=>{

            let pending = 0;
            
            gun
                .get("@app")
                .get(page)
                .get("posts")
                .map()
                .once((value:any, pub:string) => {

                    if (value === undefined) return;
                        // this pub has a discovery record
                    
                    //if (typeof pub !== "string") return;

                    const soul = getPostDocumentSoul(page, pub);

                    
                    gun.get(soul).once(async (item:any) => {


                        if(item) {
                       
                            const timestamp = item._?.[">"]?.document;

                            const postId = `${pub}:${timestamp}`;
                
                            if (timestamp && !seenPosts.has(postId)) {
                
                          
                         
                            seenPosts.add(postId);
    
                            
                            posts.current.push({...item,sourcePublicKey:pub});
                            

                            pending++;


                            setPaginationCount(Math.ceil(posts.current.length / POSTS_PER_PAGE))
                                
                        
                            if (pending >= POSTS_PER_PAGE) {
        
                                pending = 0;
                                posts.current.sort((a, b) => a._?.[">"]?.document - b._?.[">"]?.document);
                                
                        
                            }
                            

                            const index = posts.current.findIndex(
                                post =>
                                    post.sourcePublicKey === pub &&
                                    post._?.[">"]?.document === timestamp
                            );
                
                            const startIndex =
                                (pageIndex - 1) * POSTS_PER_PAGE;
                
                            const endIndex =
                                startIndex + POSTS_PER_PAGE;
                
                            if (index >= startIndex && index < endIndex) {
                                parseItem(
                                    item,
                                    pub,
                                    timestamp
                                );
                            }
                        }
                    }
                    });
                });

                
            })
        }


        
    }, [url,user.is]);

    const [, forceUpdate] = useState(0);

    useEffect(()=>{

        if(!drawingEnabled) return;

        setDrawingOwnedEnabled(true);

    },[drawingEnabled])
    
    useEffect(() => {
        pageCursorStyle.textContent = addTextEnabled
            ? `
                * {
                    cursor: text !important;
                }
            `
            : "";
    }, [addTextEnabled]);


    function createPostRequest(
        pub: string,
        page: string
      ): any {

        

        return {
          _protocol: {
            version: 1
          },
          _pub: pub,
          _page: page,
          _sig: "",
          url:window.location.href,
          payload: {
            drawing: (drawing.current.strokes.length === 0) ? "stub" : { strokes:drawing.current.strokes.map(stroke => ({ ...stroke, points: encodePoints(stroke.points) }))},
            texts: (texts.current.length === 0) ? "stub" : structuredClone(texts.current)
          }
        };
      }
    
   
    async function saveText(textObject: TextObject,content:string) {
        // Strip HTML tags to see if there's actually any text
        const plainText = content
            .replace(/<[^>]*>/g, "")
            .trim();
    
        // Don't save empty text boxes
        if (plainText.length === 0) {
            return;
        }

        textObject.content = plainText;
     
        texts.current.push({
            ...textObject,
        });

        const keyid = await publicKeyId(user.is!.pub);

        const id = keyid.slice(0, 10) + "..." + keyid.slice(-10);

        const textDisplay:TextDisplay = {
            text:textObject,
            visible: true,
            id,
            since:"now"
        }

        texts_display.current.push({...textDisplay})

        markDirty();
    
        renderCanvas();
    }


    useEffect(()=>{
        const canvas = canvasRef.current!;


        if(canvas) {
            const ctx = canvas.getContext("2d")!;
    
            ctx.strokeStyle = lineColor;
            ctx.lineWidth= lineThickness;
            
        }
            
    },[lineColor,lineThickness])


    useEffect(() => {
        
        function resizeCanvas() {

            const canvas = canvasRef.current;
            if (!canvas) return;
        
            const ctx = canvas.getContext("2d")!;
        
            const scroller =
                document.scrollingElement ?? document.documentElement;
        
            const width = Math.max(scroller.scrollWidth, window.innerWidth);
            const height = Math.max(scroller.scrollHeight, window.innerHeight);
            
            rootElement.style.width = width + "px";
            rootElement.style.height = height + "px";
        
            canvas.width = width;
            canvas.height = height;
        
            ctx.lineWidth = lineThickness;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
        

            renderCanvas();
            forceUpdate(v => v + 1);
        }
    
        const canvas = canvasRef.current;
        if (!canvas) return;
    
    //    const ctx = canvas.getContext("2d")!;
    
        // Initial sizing
    
        // Viewport resize
        shadow.addEventListener("resize", resizeCanvas as EventListener);
    
        // Document layout changes
        const resizeObserver = new ResizeObserver(() => {
            resizeCanvas();
        });

        resizeObserver.observe(document.documentElement);
    
        resizeObserver.observe(rootElement);
        
        resizeCanvas();

        // DOM mutations (React, lazy loading, infinite scroll, etc.)
        const mutationObserver = new MutationObserver(() => {
            // Wait until layout has settled
            requestAnimationFrame(resizeCanvas);
        });
    
        mutationObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: false,
        });
    
        return () => {
            shadow.removeEventListener("resize", resizeCanvas as EventListener);
            resizeObserver.disconnect();
            mutationObserver.disconnect();
        };
    }, []);
    
    const lastPoint = useRef<{ x: number; y: number } | null>(null);


    function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
        const rect = e.currentTarget.getBoundingClientRect();

        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    }
    
    useEffect(()=>{

        renderCanvas();

    },[displayDrawing])

    const [editingText, setEditingText] = useState<TextObject | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);



    useEffect(() => {
        if (!editingText || !editorRef.current) return;
    
        requestAnimationFrame(() => {
            editorRef.current?.focus();
        });
    }, [editingText]);
    
    function enforcePointLimit() {
    const MAX_POINTS = 1024;

    let tp = currentStroke.current.points.length;

    for (const stroke of drawing.current.strokes) {
        tp += stroke.points.length;
    }

    let pointsToRemove = tp - MAX_POINTS;

    if (pointsToRemove <= 0) return;

    // Remove from oldest completed strokes first.
    while (pointsToRemove > 0 && drawing.current.strokes.length > 0) {
        const oldestStroke = drawing.current.strokes[0];

        if (oldestStroke.points.length <= pointsToRemove) {
            pointsToRemove -= oldestStroke.points.length;
            drawing.current.strokes.shift();
        } else {
            oldestStroke.points =
                oldestStroke.points.slice(pointsToRemove);

            pointsToRemove = 0;
        }
    }

    // If we've consumed all completed strokes,
    // remove from the beginning of the current stroke.
    if (pointsToRemove > 0) {
        currentStroke.current.points =
            currentStroke.current.points.slice(pointsToRemove);
    }
}

const [textLimitError, setTextLimitError] = useState<{
    x: number;
    y: number;
} | null>(null);

const textLimitErrorTimer = useRef<number | null>(null);

    function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
        
    
        if(addTextEnabled) {


            const p = getPoint(e);

            const textCount = texts.current.length;

            if (textCount >= 8) {

                setTextLimitError({
                    x: p.x,
                    y: p.y,
                });

                if (textLimitErrorTimer.current !== null) {
                    clearTimeout(textLimitErrorTimer.current);
                }
            
                textLimitErrorTimer.current = window.setTimeout(() => {
                    setTextLimitError(null);
                    textLimitErrorTimer.current = null;
                }, 2000);

                return;
            }
    
            const normalizedX = p.x / window.innerWidth;
            const normalizedY = p.y / window.innerHeight;

            setEditingText({
                    location: p,
                    normalizedLocation: { x: normalizedX, y: normalizedY },
                    content: " ",
                    viewportWidth: window.innerWidth,
            });

            setAddTextEnabled(false);
          
            renderCanvas();
            return;
        }
        
        if (!drawingEnabled) return;
    
        isDrawing.current = true;
    
        const p = getPoint(e);
    
        const normalizedX = p.x / window.innerWidth;
        const normalizedY = p.y / window.innerHeight;

        currentStroke.current.normalizedLocation = {x:normalizedX,y:normalizedY};
        currentStroke.current.points = [{x:0,y:0}];
        currentStroke.current.location = p;
        currentStroke.current.color = lineColor;
        currentStroke.current.viewportWidth = window.innerWidth;

        lastPoint.current = {x:0,y:0};
        totalPoints = 0;

        for(let i = 0; i<drawing.current.strokes.length;i++) {
            totalPoints+=drawing.current.strokes[i].points.length;
        }
    
        enforcePointLimit();
        renderCanvas();
        
        e.currentTarget.setPointerCapture(e.pointerId);
    }

    function renderCanvas() {
        const canvas = canvasRef.current;
        if (!canvas) return;
    
        // we need to distinguish our drawings vs others drawings and only draw own


        const ctx = canvas.getContext("2d")!;
    
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    

        
        // Completed strokes
        if(drawingOwnedEnabled) {
            for (const stroke of drawing.current.strokes) {
                let deltaStroke = Math.abs(window.innerWidth - stroke.viewportWidth);

                if(deltaStroke < 40) {
                    drawSmoothStroke(ctx, stroke.points,stroke.color,stroke.normalizedLocation,stroke.location,stroke.thickness);
                }
            }

            drawSmoothStroke(ctx, currentStroke.current.points,currentStroke.current.color,currentStroke.current.normalizedLocation,currentStroke.current.location,lineThickness);
        
        }

        if(drawingOthersEnabled) {
            for (const stroke of drawings.current) {
                let deltaStroke = Math.abs(window.innerWidth - stroke.viewportWidth);

                if(deltaStroke < 40) {
                    drawSmoothStroke(ctx, stroke.points,stroke.color,stroke.normalizedLocation,stroke.location,stroke.thickness);
                }
            }
        }

        
    }

    function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
        if (!isDrawing.current) return;
    
        const pa = getPoint(e);
    
        const p = {
            x: pa.x - currentStroke.current.location.x,
            y: pa.y - currentStroke.current.location.y
        };
    
        const last = lastPoint.current!;
    
        const dx = p.x - last.x;
        const dy = p.y - last.y;
    
        const dist = Math.hypot(dx, dy);
    
        if (dist < 5) return;
    
        const steps = Math.floor(dist / 5);
    
        for (let i = 1; i <= steps; i++) {
            const t = (i * 5) / dist;
    
            currentStroke.current.points.push({
                x: last.x + dx * t,
                y: last.y + dy * t,
            });
        }
    
        // Include the current stroke when calculating the total.
        let totalPoints = currentStroke.current.points.length;
    
        for (const stroke of drawing.current.strokes) {
            totalPoints += stroke.points.length;
        }
    
        // Remove oldest points until we're back at 1024.
        let pointsToRemove = totalPoints - 1024;
    
        while (pointsToRemove > 0 && drawing.current.strokes.length > 0) {
    
            const oldestStroke = drawing.current.strokes[0];
    
            if (oldestStroke.points.length <= pointsToRemove) {
    
                // Remove the entire oldest stroke.
                pointsToRemove -= oldestStroke.points.length;
    
                drawing.current.strokes.shift();
    
            } else {
    
                // Only part of the oldest stroke needs to disappear.
                oldestStroke.points =
                    oldestStroke.points.slice(pointsToRemove);
    
                pointsToRemove = 0;
            }
        }
    
        // If the completed strokes didn't have enough points to remove,
        // trim the beginning of the current stroke too.
        if (pointsToRemove > 0) {
    
            currentStroke.current.points =
                currentStroke.current.points.slice(pointsToRemove);
    
            pointsToRemove = 0;
        }
    
        lastPoint.current =
            currentStroke.current.points[
                currentStroke.current.points.length - 1
            ];
    
        renderCanvas();
    }

    useEffect(()=>{
        renderCanvas();
    },[drawingOthersEnabled,drawingOwnedEnabled])

    function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
        
        if (!isDrawing.current) return;
    
        isDrawing.current = false;
       


        if (currentStroke.current.points.length > 0) {

            let pointCount = 0;
            

            for (let i = 0; i < drawing.current.strokes.length; i++) {

                const stroke = drawing.current.strokes[i];

                const remaining = 1024 - pointCount;

                if (stroke.points.length <= remaining) {
                    pointCount += stroke.points.length;
                    continue;
                }

                // This stroke exceeds the remaining budget.
                stroke.points = stroke.points.slice(0, remaining);

                // Keep this partially-trimmed stroke, remove everything after it.
                drawing.current.strokes =
                    drawing.current.strokes.slice(0, i + 1);

                break;
            }

            drawing.current.strokes.push({
                color: currentStroke.current.color,
                points: [...currentStroke.current.points],
                normalizedLocation: currentStroke.current.normalizedLocation,
                location: currentStroke.current.location,
                viewportWidth:window.innerWidth,
                thickness:lineThickness
            });
        }
    
        currentStroke.current.points = [];
        lastPoint.current = null;
    
        renderCanvas();
    
        e.currentTarget.releasePointerCapture(e.pointerId);
        markDirty();

    }

    function onTextPointerDown(e: PointerEvent) {
        
        if (!draggingText.current) return;
    
        const { text, offsetX, offsetY } = draggingText.current;
    
        text.text.location.x = e.clientX - offsetX;
        text.text.location.y = e.clientY - offsetY;
    
        text.text.normalizedLocation.x = text.text.location.x / window.innerWidth;
        text.text.normalizedLocation.y = text.text.location.y / window.innerHeight;
    
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    }


    function onTextDrag(e: PointerEvent) {
        
        if (!draggingText.current) return;
    
        const { text, offsetX, offsetY } = draggingText.current;
    
        text.text.location.x = e.clientX - offsetX;
        text.text.location.y = e.clientY - offsetY;
    
        text.text.normalizedLocation.x =
            text.text.location.x / window.innerWidth;
    
        text.text.normalizedLocation.y =
            text.text.location.y / window.innerHeight;
    
        forceUpdate(v => v + 1);

    }
    
    function stopDraggingText(e: PointerEvent) {
        const drag = draggingText.current;
    
        if (!drag) return;
    
        if (drag.element.hasPointerCapture(e.pointerId)) {
            drag.element.releasePointerCapture(e.pointerId);
        }
    
        draggingText.current = null;
    
        shadow.removeEventListener(
            "pointermove",
            onTextDrag as EventListener
        );
    
        shadow.removeEventListener(
            "pointerup",
            stopDraggingText as EventListener
        );
    
        shadow.removeEventListener(
            "pointercancel",
            stopDraggingText as EventListener
        );
    
        markDirty();
    }

    const [textsAbove, setTextsAbove] = useState(0);
    const [textsBelow, setTextsBelow] = useState(0);
    
    const updateOffscreenTextCounts = () => {
        const scrollTop = window.scrollY;
        const viewportHeight = window.innerHeight;
    
        let above = 0;
        let below = 0;

         
        for (const textObject of other_texts_display.current) {
            const y = textObject.text.location.y - scrollTop;
    
            const deltaText = Math.abs(
                window.innerWidth - textObject.text.viewportWidth
            );
        
        
            const textApplicable = deltaText < 40;
        
            if (!textApplicable) continue;
  
            
            if (y < 0) {
                above++;
            } else if (y > viewportHeight) {
                below++;
            }
        }


        setTextsAbove(above);
        setTextsBelow(below);
    };



    useEffect(() => {
        updateOffscreenTextCounts();
    
        window.addEventListener("scroll", updateOffscreenTextCounts, {
            passive: true,
        });
    
        window.addEventListener("resize", updateOffscreenTextCounts);
    
        return () => {
            window.removeEventListener("scroll", updateOffscreenTextCounts);
            window.removeEventListener("resize", updateOffscreenTextCounts);
        };
    }, []);


    return (
        <>
 
        <div  className="host">
            {<canvas 
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
                className={`drawing ${drawingEnabled || addTextEnabled ? "enabled" : ""}`}
            />}

{textsAbove > 0 && (
    <div className="text-offscreen-indicator top">
        ↑ {textsAbove}
    </div>
)}

{textsBelow > 0 && (
    <div className="text-offscreen-indicator bottom">
        ↓ {textsBelow}
    </div>
)}

{textLimitError && (
    <div
        className="text-limit-error"
        style={{
            left: textLimitError.x,
            top: textLimitError.y,
        }}
    >
        Maximum 8 texts
    </div>
)}

{(textOwnedEnabled) && texts_display.current.map((textObject, index) => {
    const x =
        textObject.text.normalizedLocation.x * window.innerWidth;

    const deltaText = Math.abs(
        window.innerWidth - textObject.text.viewportWidth
    );


    const textApplicable = deltaText < 40;

    if (!textApplicable) return null;

    const lines = textObject.text.content.split("\n");
    const removeCallback = ()=>{

        texts_display.current = texts_display.current.filter(
            (_, i) => i !== index
        );

        texts.current = texts.current.filter(
            (_, i) => i !== index
        );

        forceUpdate(v => v + 1);
        markDirty();

    }

    const dragTextCallback = (e:any) => {
                    
        e.stopPropagation();

        draggingText.current = {
            text: textObject,
            offsetX: e.clientX - textObject.text.location.x,
            offsetY: e.clientY - textObject.text.location.y,
            element: e.currentTarget
        };

        e.currentTarget.setPointerCapture(e.pointerId);


        shadow.addEventListener("pointerdown", onTextPointerDown as EventListener);
        shadow.addEventListener("pointermove", onTextDrag as EventListener);
        shadow.addEventListener("pointerup", stopDraggingText as EventListener);

    }


    const visibilityCallback = () => {
        textObject.visible = !textObject.visible;
        forceUpdate(v => v + 1);
    }

    const zIndex = MAX_Z - (texts.current.length + index);
    const location = {
        x: x,
        y: textObject.text.location.y,
       
    }
    return (<TextItem since={textObject.since} id={textObject.id} menuActive={true} dragCallback={dragTextCallback} visibilityCallback={visibilityCallback}
        removeCallback={removeCallback} visible={textObject.visible} lines={lines}  zIndex={zIndex}
        location={location} index={index} textObject={textObject}/>
    );
})}

{(textOthersEnabled) && other_texts_display.current.map((textObject, index) => {
    const x =
        textObject.text.normalizedLocation.x * window.innerWidth;

    const deltaText = Math.abs(
        window.innerWidth - textObject.text.viewportWidth
    );

    const textApplicable = deltaText < 40;

    if (!textApplicable) return null;


    const lines = textObject.text.content.split("\n");
    const removeCallback = ()=>{}
    const dragTextCallback = (e:any) => {console.log(e)};

    const visibilityCallback = () => {
        textObject.visible = !textObject.visible;
        forceUpdate(v => v + 1);
    }

    const zIndex = MAX_Z - (other_texts.current.length + index);
    const location = {
        x: x,
        y: textObject.text.location.y,
       
    }

  
   
    return (<TextItem since={textObject.since} id={textObject.id} menuActive={false} dragCallback={dragTextCallback} visibilityCallback={visibilityCallback}
        removeCallback={removeCallback} visible={textObject.visible} lines={lines}  zIndex={zIndex}
        location={location} index={index} textObject={textObject}/>
    );
})}

            {
            

            editingText && (
                
                <div
                    contentEditable
                    suppressContentEditableWarning
                    ref={editorRef}
                    style={{
                        position: "absolute",
                        left: editingText.location.x,
                        top: editingText.location.y,
                        transform: (editingText.location.x > window.innerWidth / 2) ? "translateX(-100%)" : undefined,
        
                        pointerEvents: "auto",
                        zIndex: 999999,
                        background: "white",
                        color: "black",
                        borderTopRightRadius:(editingText.location.x > window.innerWidth / 2)? 0: 12,
                        borderTopLeftRadius:(editingText.location.x > window.innerWidth / 2)?12:0,
                        borderBottomLeftRadius:12,
                        borderBottomRightRadius:12,
                        borderStyle:'solid',
                        borderColor:'#888888',
                        minWidth: 50,
                        minHeight: 20,
                        paddingTop: 5,
                        paddingBottom:5,
                        paddingLeft:10,
                        paddingRight:10,
                        outline: "none",
                        fontSize: 14
                        
                    }}
                    onInput={(e) => {
                        const element = e.currentTarget;
                        const text = element.innerText;
                    
                        if (text.length > 512) {
                            const selection = window.getSelection();
                    
                            element.innerText = text.slice(0, 512);
                    
                            // Put cursor back at the end
                            if (selection) {
                                const range = document.createRange();
                                range.selectNodeContents(element);
                                range.collapse(false);
                                selection.removeAllRanges();
                                selection.addRange(range);
                            }
                        }
                    }}
                    onBlur={async (e) => {
                        await saveText(editingText,
                            e.currentTarget.innerText.trim(),
                        );
                        setAddTextEnabled(false);
                        setEditingText(null);
                    }}
                />
            )}

            <Overlay
            pageIndex={pageIndex}
            setPageIndex={setPageIndex}
            paginationCount={paginationCount}
            drawingOwnedEnabled={drawingOwnedEnabled}
            setDrawingOwnedEnabled={setDrawingOwnedEnabled}
            drawingOthersEnabled={drawingOthersEnabled}
            setDrawingOthersEnabled={setDrawingOthersEnabled}
            textOwnedEnabled={textOwnedEnabled}
            setTextOwnedEnabled={setTextOwnedEnabled}
            textOthersEnabled={textOthersEnabled}
            setTextOthersEnabled={setTextOthersEnabled}
            shadow={shadow}
            loggedIn={loggedIn}
            loginFunction={login}
            logoutFunction={logout}
            createFunction={createUser}
            setLoggedIn={setLoggedIn}
                displayDrawing={displayDrawing}
                setDisplayDrawing={setDisplayDrawing}
                displayText={displayText}
                setDisplayText={setDisplayText}
                drawingEnabled={drawingEnabled}
                setDrawingEnabled={setDrawingEnabled}
                setLineColor={setLineColor}
                setLineThickness={setLineThickness}
                addTextEnabled={addTextEnabled}
                setAddTextEnabled={setAddTextEnabled}
            />
        </div>
        </>
    );
}

gunReady.then(() => {
    createRoot(rootElement).render(<App />);
}).catch((error) => {
    console.error("Failed to initialize Fuzzz:", error);
});