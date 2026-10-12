declare module "vanta/dist/vanta.net.min" {
  type VantaEffect = { destroy(): void; resize(): void; setOptions(opts: Record<string, unknown>): void };
  const NET: (opts: Record<string, unknown>) => VantaEffect;
  export default NET;
}
