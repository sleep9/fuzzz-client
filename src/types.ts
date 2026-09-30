import type {JSONSchemaType} from "ajv";


interface ProtocolSchemaRequest {
    version:number;
}

export const protocolSchema:JSONSchemaType<ProtocolSchemaRequest> = {
    type:'object',
    properties:{
        version:{type:'number'}
    },
    required:['version'],
    additionalProperties:false
}

export interface Point {
    x: number;
    y: number;
}

export interface TextObject {
    normalizedLocation:Point;
    location:Point;
    viewportWidth:number;
    content:string;
}

export interface TextObjectWithId extends TextObject {
    id:string;
}


const pointSchema: JSONSchemaType<Point> = {
    type: "object",
    properties: {
        x: { type: "number" },
        y: { type: "number" }
    },
    required: ["x", "y"],
    additionalProperties: false
};


export const textSchema:JSONSchemaType<TextObject> = {
    type:"object",
    properties:{
        content:{type:'string',maxLength:512},
        location:pointSchema,
        normalizedLocation:pointSchema,
        viewportWidth:{type:'number'},
    },
    required:['content','location','normalizedLocation','viewportWidth'],
    additionalProperties:false
}

export interface Stroke {
    points:Point[];
    color:string;
    viewportWidth:number;
    thickness:number;
    normalizedLocation:Point;
    location:Point;

}


export const strokeSchema: JSONSchemaType<Stroke> = {
    type: "object",
    properties:{
        points: {
            type: "array",
            items: pointSchema,
            maxItems: 2048
        },
        
        color: {
            type: "string",
            pattern: "^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
        },
        
        thickness: {
            type: "integer",
            enum: [1, 2, 3]
        },

        normalizedLocation: pointSchema,
        location:pointSchema,

        
        viewportWidth: {
            type: "number"
        }
    },

    required: [
        "points",
        "color",
        "thickness",
        "viewportWidth",
        "location",
        "normalizedLocation"
    ],

    additionalProperties: false
};



export const drawingSchema: JSONSchemaType<Drawing> = {
    type: "object",
    properties: {
        strokes: {
            type: "array",
            items: strokeSchema,
            maxItems:500
        }
    },
    required: [
        "strokes"
    ],
    additionalProperties: false
};

export interface Drawing {
    strokes: Stroke[];
}

export interface PubkeyDocument {
    texts: TextObject[] | "stub";
    drawing: Drawing | "stub";
}

export const drawingDocumentSchema: JSONSchemaType<PubkeyDocument> = {
    type: "object",
    properties: {
        texts: {
            anyOf: [
                {
                    type: "array",
                    items: textSchema
                },
                {
                    type: "string",
                    const: "stub"
                }
            ]
        },
        drawing: {
            anyOf: [
                drawingSchema,
                {
                    type: "string",
                    const: "stub"
                }
            ]
        }
    },
    required: ["texts", "drawing"],
    additionalProperties: false
};

export const postSchema: JSONSchemaType<PostSchemaRequest> = {
    type: "object",
    properties: {
        _protocol: protocolSchema,
        _pub: { type: "string" },
        _page: { type: "string" },
        _sig:{type:'string'},
        url:{type:'string'},
        payload:drawingDocumentSchema,
           
    },
    required: [
        "_protocol",
        "_pub",
        "_page",
        "url",
        "payload"
    ],
    additionalProperties: false
};

export interface PostSchemaRequest {
    _pub:string;
    _protocol:ProtocolSchemaRequest;
    _page:string;
    _sig:string;
    url:string;
    payload:PubkeyDocument;
}