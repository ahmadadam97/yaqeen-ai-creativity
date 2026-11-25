import { Composition } from "remotion";
import { NameReel, totalFrames } from "./NameReel";
import sample from "./storyboard.json";
import type { Storyboard } from "./types";

// Any storyboard from the pipeline can be passed with --props=out/<id>/storyboard.json
export const RemotionRoot: React.FC = () => (
  <Composition
    id="NameReel"
    component={NameReel}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={1}
    defaultProps={sample as Storyboard}
    calculateMetadata={({ props }) => ({ durationInFrames: totalFrames(props), fps: props.fps })}
  />
);
