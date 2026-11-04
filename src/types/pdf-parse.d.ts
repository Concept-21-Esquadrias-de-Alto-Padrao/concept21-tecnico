declare module "pdf-parse" {
  import type { Buffer } from "node:buffer";

  type PdfParseResult = {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    text: string;
    version: string;
  };

  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  import type { Buffer } from "node:buffer";

  type PdfParseResult = {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    text: string;
    version: string;
  };

  function pdfParse(dataBuffer: Uint8Array, options?: {pagerender(page: {getTextContent(): Promise<{items: {str:string; transform:number[]}[]}>}): Promise<string>}): Promise<PdfParseResult>;
  export = pdfParse;
}
