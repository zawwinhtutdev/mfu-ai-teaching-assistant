// dommatrix ships a plain CJS bundle without TypeScript declarations.
// Only the default export is used, to polyfill pdf.js's DOMMatrix global.
declare module "dommatrix" {
  const DOMMatrix: any
  export default DOMMatrix
}
