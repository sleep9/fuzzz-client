import React from "react"
//const HStack = ({ children, classNames ,style,...props }: { children: React.ReactNode, classNames?:string,style?:React.CSSProperties }) => {

const VStack = ({ children,classNames ,id, style,...props }: { children: React.ReactNode,id?:string,classNames?:string,style?:React.CSSProperties}) => {
  return (
    <div id={(id)?id:''} style={{flexFlow:'column',  display: "flex", flex: "flex-col",...style}} className={`flex flex-col ${classNames}`} {...props}>
      {children}
    </div>
  )
}

export default VStack
