declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }

  function pdfParse(dataBuffer: Buffer): Promise<PDFData>;
  export default pdfParse;
}

declare module 'csv-parser' {
  import { Transform } from 'stream';
  function csvParser(options?: Record<string, unknown>): Transform;
  export default csvParser;
}
