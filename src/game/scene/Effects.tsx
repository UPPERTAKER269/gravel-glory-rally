// High-quality post: gentle bloom on hot highlights, ACES tone mapping, grade, vignette, SMAA.
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export function Effects({ saturation = 0.12, bloomThreshold = 0.95 }: { saturation?: number; bloomThreshold?: number }) {
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur intensity={0.45} luminanceThreshold={bloomThreshold} luminanceSmoothing={0.2} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation saturation={saturation} />
      <BrightnessContrast brightness={0.01} contrast={0.08} />
      <Vignette offset={0.32} darkness={0.55} />
      <SMAA />
    </EffectComposer>
  );
}
