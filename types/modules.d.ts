declare module 'pdf-parse' {
  const pdfParse: (data: Buffer | Uint8Array) => Promise<{
    text: string;
    numpages?: number;
    info?: Record<string, unknown>;
  }>;
  export default pdfParse;
}

declare module 'js-yaml' {
  const yaml: {
    load: (input: string) => unknown;
  };
  export default yaml;
}
