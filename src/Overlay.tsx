import {
    //BellIcon,
    //UsersThreeIcon,
    PaintBrushIcon,
    //BookmarkSimpleIcon,
    //ChatCircleTextIcon,
    GearIcon,
    //TextAaIcon,
    ScribbleLoopIcon,
    ListPlusIcon,
    ListIcon,
    CaretLeftIcon,
    WarningCircleIcon,
    ResizeIcon
    
} from "@phosphor-icons/react";

import HStack from "./HStack";
import VStack from "./VStack";
import React, { useState,useRef,useEffect } from "react";
import type { UserIdentity } from "./content";
interface OverlayProps {
    drawingEnabled: boolean;
    addTextEnabled: boolean;
    textOwnedEnabled: boolean;
    textOthersEnabled:boolean;
    drawingOwnedEnabled:boolean;
    drawingOthersEnabled:boolean;
    paginationCount:number;
    pageIndex:number;
    setPageIndex:React.Dispatch<React.SetStateAction<number>>;
    setDrawingOwnedEnabled:React.Dispatch<React.SetStateAction<boolean>>;
    setDrawingOthersEnabled:React.Dispatch<React.SetStateAction<boolean>>;

    setTextOthersEnabled:React.Dispatch<React.SetStateAction<boolean>>;
    setTextOwnedEnabled:React.Dispatch<React.SetStateAction<boolean>>;
    setAddTextEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    setDrawingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    setLineColor: React.Dispatch<React.SetStateAction<string>>;
    setLineThickness: React.Dispatch<React.SetStateAction<number>>;
    shadow: ShadowRoot;
    setDisplayText: React.Dispatch<React.SetStateAction<boolean>>;
    setDisplayDrawing: React.Dispatch<React.SetStateAction<boolean>>;
    displayText:boolean;
    displayDrawing:boolean;
    loggedIn:boolean;
    setLoggedIn:React.Dispatch<React.SetStateAction<boolean>>;
    loginFunction:(alias: string, password: string) => Promise<UserIdentity>;
    logoutFunction:()=>Promise<void>;
    createFunction:(alias:string,password:string)=>Promise<UserIdentity>;
}

function ThicknessPicker({thickness,selected,style,setThickness,setThicknessPickerIndex,index}:{thickness:number,selected:boolean,style:React.CSSProperties,setThickness:any,setThicknessPickerIndex:any,index:number}) {

    return <div onClick={()=>{
        setThickness(thickness)
        setThicknessPickerIndex(index)
    }}
    className={(selected) ? "thickness-picker selected" : "thickness-picker"}
    style={{...style,display:'flex',alignItems:'center',width:'100%',height:32}}
    >

        <div style={{backgroundColor:"#000000",height:thickness,borderRadius:thickness/2.0,width:'100%'}}></div>

    </div>

}

function ColorPick({color,setColor}:{color:string,setColor:any}) {

    return <div 
    onClick={()=>{
        setColor(color)
    }}
    className="color-pick" style={{cursor:'pointer',borderRadius:16,backgroundColor:color, width:32,height:32}}></div>
}

export const LoginState = {
    Select: "Login Select",
    Create: "Create User",
    Login: "Login User",
    Success: "Login Success",
    LoginError: "Login Error",
    CreateError: "Create Error",
  } as const;

export type LoginState = typeof LoginState[keyof typeof LoginState];

interface GunError {
    reason:string;
}


export default function Overlay({ 
    drawingOthersEnabled,
    drawingOwnedEnabled,
    setDrawingOthersEnabled,
    setDrawingOwnedEnabled,
    paginationCount,
    pageIndex,
    setPageIndex,
    textOthersEnabled,setTextOthersEnabled,textOwnedEnabled,setTextOwnedEnabled,shadow,logoutFunction,loginFunction,createFunction,loggedIn,displayDrawing,displayText,setDisplayDrawing,setDisplayText,drawingEnabled,addTextEnabled,setAddTextEnabled,setLineThickness,setDrawingEnabled,setLineColor}:OverlayProps) {

    console.log(setDisplayText);
    console.log(displayText);
    console.log(setDisplayDrawing);
    console.log(displayDrawing);

    const toolRef = useRef<HTMLDivElement>(null);
    const loginToolRef = useRef<HTMLDivElement>(null);
    const textToolRef = useRef<HTMLDivElement>(null);
    const drawingToolRef = useRef<HTMLDivElement>(null);
    const resizeToolRef = useRef<HTMLDivElement>(null);

    const [resizePanelOpen,setResizePanelOpen] = useState<boolean>(false);
    const [paintPanelOpen,setPaintPanelOpen] = useState<boolean>(false);
    const [loginPanelOpen,setLoginPanelOpen] = useState<boolean>(false);
    const [textPanelOpen,setTextPanelOpen] = useState<boolean>(false);
    const [drawingPanelOpen,setDrawingPanelOpen] = useState<boolean>(false);

    const [thicknessPickerIndex,setThicknessPickerIndex] = useState<number>(1);

    const [loggingIn,setLoggingIn] = useState<boolean>(false);
    const [signingUp,setSigningUp] = useState<boolean>(false);

    const [alias,setAlias] = useState<string>('');
    const [password,setPassword] = useState<string>('');

    const [newAlias,setNewAlias] = useState<string>('');
    const [newPassword,setNewPassword] = useState<string>('')

    const [signupError,setSignupError] = useState<GunError|null>(null);
    const [loginError,setLoginError] = useState<GunError|null>(null);

    const [loginPanelState,setLoginPanelState] = useState<LoginState>(LoginState.Select)


    useEffect(()=>{

        if(loggedIn) {
            
            setLoginPanelState(LoginState.Success)
        
        } else {
            setLoginPanelState(LoginState.Login);
        }

    },[loggedIn])

    const setThickness = (value:number)=>{
        setLineThickness(value)
    }

    const concludePaint = (color:string) => {

        setLineColor(color);
        setPaintPanelOpen(false);
    }

    useEffect(() => {
        function handleShadowPointerDown(e: PointerEvent) {
            const path = e.composedPath();
    
            if (
                toolRef.current &&
                !path.includes(toolRef.current)
            ) {
                setPaintPanelOpen(false);
            }

            if(resizeToolRef.current &&
                !path.includes(resizeToolRef.current)
            ) {
                setResizePanelOpen(false);
            }
    
            if (
                loginToolRef.current &&
                !path.includes(loginToolRef.current)
            ) {
                setLoginPanelOpen(false);
                setLoginError(null);
                setSignupError(null);
            }
    
            if (
                textToolRef.current &&
                !path.includes(textToolRef.current)
            ) {
                setTextPanelOpen(false);
            }

            if (
                drawingToolRef.current &&
                !path.includes(drawingToolRef.current)
            ) {
                setDrawingPanelOpen(false);
            }
        }
    
        function handleDocumentPointerDown(e: PointerEvent) {
            // If the click originated inside our shadow root,
            // let the shadow listener deal with it.
            if (e.composedPath().includes(shadow.host)) {
                return;
            }
    
            // This was genuinely outside our shadow tree.
            setPaintPanelOpen(false);
            setLoginPanelOpen(false);
            setTextPanelOpen(false);
            setDrawingPanelOpen(false);
            setResizePanelOpen(false);
            setLoginError(null);
            setSignupError(null);
        }
    
        shadow.addEventListener(
            "pointerdown",
            handleShadowPointerDown as EventListener
        );
    
        shadow.host.ownerDocument.addEventListener(
            "pointerdown",
            handleDocumentPointerDown,
            true
        );
    
        return () => {
            shadow.removeEventListener(
                "pointerdown",
                handleShadowPointerDown as EventListener
            );
    
            shadow.host.ownerDocument.removeEventListener(
                "pointerdown",
                handleDocumentPointerDown,
                true
            );
        };
    }, [shadow]);
    return (
        <div className="dock">


{(loginPanelState === LoginState.Success) ?
    <div className="tool" ref={textToolRef}>

<div id="text-panel"   
className={textPanelOpen ? "open":""} style={{padding:8}}>
    <VStack>
        <button className={textOwnedEnabled ? "active" : ""}
    style={{width:'100%',cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
    
        setTextOwnedEnabled(v=>!v);

        }}>
        <div>Your Posts</div>  
    </button>

    <button className={textOthersEnabled ? "active" : ""}
    style={{width:'100%',marginTop:10,cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
    
        setTextOthersEnabled(v=>!v);
       
        }}>
        <div>Others Posts</div>  
    </button>
    </VStack>
</div>
<button
onClick={()=>{
    
    //setDisplayText(v=>!v);
    setTextPanelOpen(true);

}}
 style={{cursor:'pointer'}}>
    <ListIcon size={18} weight="bold"/>
</button>
</div> : <button className={(textOthersEnabled) ? "active" : ""}
onClick={()=>{
    
    setTextOthersEnabled((v)=>{return !v})

}}
 style={{cursor:'pointer'}}>
    <ListIcon size={18} weight="bold"/>
</button>
}

{ (loginPanelState === LoginState.Success) ?   <div className="tool" ref={drawingToolRef}>

<div id="text-panel"   
className={drawingPanelOpen ? "open":""} style={{padding:8}}>
    
    <VStack>
        <button className={drawingOwnedEnabled ? "active" : ""}
    style={{width:'100%',cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
    
        setDrawingOwnedEnabled(v=>!v);

        }}>
        <div>Your Drawings</div>  
    </button>

    <button className={drawingOthersEnabled ? "active" : ""}
    style={{width:'100%',marginTop:10,cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
    
        setDrawingOthersEnabled(v=>!v);
       
        }}>
        <div>Others Drawings</div>  
    </button>
    </VStack>
</div> 
<button onClick={()=>{
    setDrawingPanelOpen(true)
}
}
 style={{cursor:'pointer'}}>
    <ScribbleLoopIcon size={18} weight="bold"/>
</button>
</div> : <button className={(drawingOthersEnabled) ? "active" : ""} onClick={()=>{
    setDrawingOthersEnabled((v)=>{return !v})
}
}
 style={{cursor:'pointer'}}>
    <ScribbleLoopIcon size={18} weight="bold"/>
</button>
}

{ (loginPanelState === LoginState.Success) && <button style={{cursor:'pointer'}} className={addTextEnabled ? "active" : ""}
onClick={()=>{
    setAddTextEnabled(v=>(!v));
    setDrawingEnabled(false);
}}>
    <ListPlusIcon size={18} weight="bold" />
</button>
}

<div ref={toolRef}  className="tool">
<div id="paint-panel"   
className={paintPanelOpen ? "open":""} style={{padding:8}}>
<VStack>
<HStack style={{justifyContent:'space-between'}}>
    <ColorPick color={"#000000"} setColor={concludePaint}/>
    <ColorPick color={"#444444"} setColor={concludePaint}/>
    <ColorPick color={"#888888"} setColor={concludePaint}/>
    <ColorPick color={"#cccccc"} setColor={concludePaint}/>
    <ColorPick color={"#b33319"} setColor={concludePaint}/>
</HStack>
<HStack style={{justifyContent:'space-between',marginTop:10}}>
    <ColorPick color={"#cc6600"} setColor={concludePaint}/>
    <ColorPick color={"#fcd303"} setColor={concludePaint}/>
    <ColorPick color={"#bad728"} setColor={concludePaint}/>
    <ColorPick color={"#328118"} setColor={concludePaint}/>
    <ColorPick color={"#188181"} setColor={concludePaint}/>
</HStack>
<HStack style={{justifyContent:'space-between',marginTop:10}}>
    <ColorPick color={"#288ed7"} setColor={concludePaint}/>
    <ColorPick color={"#2e419e"} setColor={concludePaint}/>
    <ColorPick color={"#2e174f"} setColor={concludePaint}/>
    <ColorPick color={"#b517a7"} setColor={concludePaint}/>
    <ColorPick color={"#e21d6f"} setColor={concludePaint}/>
</HStack>
<HStack style={{justifyContent:'space-between',marginTop:10}}>
    <ColorPick color={"#57ffc1"} setColor={concludePaint}/>
    <ColorPick color={"#d980ff"} setColor={concludePaint}/>
    <ColorPick color={"#66e5ff"} setColor={concludePaint}/>
    <ColorPick color={"#ff8595"} setColor={concludePaint}/>
    <ColorPick color={"#ffb06b"} setColor={concludePaint}/>
</HStack>

<ThicknessPicker selected={thicknessPickerIndex === 0} index={0} setThicknessPickerIndex={setThicknessPickerIndex} thickness={1.0} style={{marginTop:10}} setThickness={setThickness}/>
<ThicknessPicker selected={thicknessPickerIndex === 1} index={1} setThicknessPickerIndex={setThicknessPickerIndex} thickness={2.0} style={{marginTop:10}} setThickness={setThickness}/>
<ThicknessPicker selected={thicknessPickerIndex === 2} index={2} setThicknessPickerIndex={setThicknessPickerIndex} thickness={3.0} style={{marginTop:10}} setThickness={setThickness}/>

<HStack style={{marginTop:10}}>
<button
 className={drawingEnabled ? "active" : ""}
style={{width:'100%',cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
onClick={() => { 
    setPaintPanelOpen(false);
    setDrawingEnabled(v => !v) 
    setAddTextEnabled(false);
     
    
    }}>
    {(drawingEnabled) ? <div>Disable Draw</div> : <div>Enable Draw</div>    }
</button>
</HStack>
</VStack>

</div>

{ (loginPanelState === LoginState.Success) &&
<button style={{cursor:'pointer'}} className={drawingEnabled ? "active" : ""}
onClick={() => { 
    setPaintPanelOpen(true);
    
    }}>
    <PaintBrushIcon size={18} weight="bold" 
    
    />
        
</button>
}
</div>



<div className="tool" ref={resizeToolRef}>

{ 
    <button style={{cursor:'pointer'}}
onClick={() => { 
    setResizePanelOpen(true);
    
    }}>
    <ResizeIcon size={18} weight="bold" 
    
    />
        
</button>
}


<div id="login-panel"   
className={resizePanelOpen ? "open":""} style={{padding:8}}>

<VStack>
<HStack gap={4} style={{justifyContent:'space-between'}}>

<button
    style={{width:'100%',cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
        chrome.runtime.sendMessage({
            action: "resizeWindow",
            width: 370
          });
        }}>
        <div>370</div>  
    </button>

    <button
    style={{width:'100%',cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
        chrome.runtime.sendMessage({
            action: "resizeWindow",
            width: 768
          });
        }}>
        <div>768</div>  
    </button>
    
    <button
    style={{width:'100%',cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
        chrome.runtime.sendMessage({
            action: "resizeWindow",
            width: 1440
          });
        }}>
        <div>1440</div>  
    </button>

    <button
    style={{width:'100%',cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
        chrome.runtime.sendMessage({
            action: "resizeWindow",
            width: 1920
          });
        }}>
        <div>1920</div>  
    </button>

</HStack>
</VStack>
</div>
</div>




<div className="tool" ref={loginToolRef}>
<button  onClick={()=>{
        setLoginPanelOpen(true);
    }}
    style={{cursor:'pointer'}}>
    <GearIcon size={18} weight="bold"
   
    ></GearIcon>
</button>

<div id="login-panel"   
className={loginPanelOpen ? "open":""} style={{padding:8}}>
{

    // if we are logged in display logout
    // if we are not logged in goto
}
{(loginPanelState === LoginState.Select) ? 
<div>
    <button
    style={{width:'100%',cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
    
        setLoginPanelState(LoginState.Create)

        }}>
        <div>Create User</div>  
    </button>

    <button
    style={{marginTop:10,width:'100%',cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
    
        setLoginPanelState(LoginState.Login)

        }}>
        <div>Login</div>  
    </button>
</div> : (loginPanelState === LoginState.Success) ? <div>

<button
    style={{width:'100%',cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
        logoutFunction();
        setLoginPanelOpen(false);
        setLoginPanelState(LoginState.Select)

        }}>
        <div>Logout</div>  
    </button>

</div> : 

(loginPanelState === LoginState.Login) &&
<div>
    {  <div>
    <input
    type="text"
    className="input"
    placeholder="Alias"
    value={alias}
    onChange={(e) => setAlias(e.target.value)}
    />

    <input
        style={{marginTop:10}}
    type="password"
    className="input"
    placeholder="Password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    />

<HStack gap={8} style={{width:'100%'}}>

    <button onClick={()=>{
        setLoginPanelState(LoginState.Select)
        setLoginError(null);
    }}
    style={{marginTop:10,aspectRatio:1,cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
   
    >
        <CaretLeftIcon size={18} weight="bold"/>
    
    </button>

    <button
    disabled={loggingIn}
    className={loggingIn ? "active" : ""}
    style={{marginTop:10,width:'100%',cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
    
        setLoggingIn(true)
        
        try {
            const identity = await loginFunction(alias, password);
            console.log(loggedIn);
            console.log(identity.pub);
            console.log(identity.alias);
           
        } catch (err) {
            console.log('login fail')
            console.error(err);


            if (err instanceof Error) {
                setLoginError({reason:err.message});
            } else {
                setLoginError({reason:"Unable to log in."});
            }

            setLoggingIn(false);
            return;
        }

        setLoginPanelOpen(false);
        setLoggingIn(false);
        setLoginError(null);

        }}>
        <div>Login</div>  
    </button>
    </HStack>

    {loginError!==null && (
    <div className="login-toast">
    <WarningCircleIcon size={16} weight="fill" />
    <span>{loginError.reason}</span>
  </div>
    )}

    </div>}
</div>
}

{ (loginPanelState === LoginState.Create) && 
    <div>
    { <div>
    <input
    type="text"
    className="input"
    placeholder="Alias"
    value={newAlias}
    onChange={(e) => setNewAlias(e.target.value)}
    />

    <input
        style={{marginTop:10}}
    type="password"
    className="input"
    placeholder="Password"
    value={newPassword}
    onChange={(e) => setNewPassword(e.target.value)}
    />

<HStack gap={8} style={{width:'100%'}}>

    <button onClick={()=>{
        setLoginPanelState(LoginState.Select)
        setSignupError(null);
    }}
    style={{marginTop:10,aspectRatio:1,cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
   
    >
        <CaretLeftIcon size={18} weight="bold"/>
    
    </button>

    <button
    disabled={signingUp}
    className={signingUp ? "active" : ""}
    style={{marginTop:10,width:'100%',cursor:'pointer',borderRadius:12,border:'1px solid #E0E0E0',padding:4}}
    onClick={async () => { 
        
        setSigningUp(true)
        
        
        
        try {
            
            const identity = await createFunction(newAlias, newPassword);
        
            console.log(identity.pub);
            console.log(identity.alias);

            

        } catch (err) {
            console.error(err);
        
            if (err instanceof Error) {
                setSignupError({reason:err.message});
            } else {
                setSignupError({reason:"Unable to log in."});
            }

          
        }

       // setLoginPanelState(LoginState.Success)
        setLoginPanelOpen(false);
        setSignupError(null);
        setLoginError(null);
        setLoggingIn(false);
        setSigningUp(false)

        }}>
        <div>Create</div>  
    </button>
    </HStack>

    {signupError && (
    <div className="login-toast">
    <WarningCircleIcon size={16} weight="fill" />
    <span>{signupError.reason}</span>
  </div>
    )}

    </div>}
</div>

}




</div>
</div>

{ (paginationCount > 1) &&

<div>

<div style={{padding:4}}>
<div style={{width:'100%',height:1,backgroundColor:'#E7E7E7'}}/>
</div>

{
    <div
    style={{
        minHeight: Math.min(paginationCount,3)*36,
        height: Math.min(paginationCount,3)*36,
        
        overflowY: "auto",
    }}
>
    { Array.from({ length: paginationCount }, (_, index) => (
        <button onClick={()=>{
            setPageIndex(index+1);
        }} style={{color:(pageIndex === index+1) ? 'black':'#e7e7e7'}} key={index}>
            {index + 1}
        </button>
    ))}

    </div>

}


</div>
}


        </div>
    );
}