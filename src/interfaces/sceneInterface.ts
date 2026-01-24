import type { GeometryData } from "../types/geometry";
import type { HelperData } from "../types/helper";
import type { MaterialData } from "../types/material";

/**
 * Scene object definition kept in the store and synchronized to Three.js.
 */
export type SceneBackgroundType = 'none' | 'color' | 'texture' | 'cube';
export type SceneEnvironmentType = 'none' | 'equirect' | 'hdr' | 'cube';
export type SceneFogType = 'none' | 'linear' | 'exp2';
export type CameraType = 'perspective';

export interface SceneSettings {
  backgroundType?: SceneBackgroundType;
  backgroundColor?: string;
  backgroundTexture?: string;
  backgroundCube?: string[];
  environmentType?: SceneEnvironmentType;
  environmentMap?: string | string[];
  fog?: {
    type?: SceneFogType;
    color?: string;
    near?: number;
    far?: number;
    density?: number;
  };
}

export interface CameraSettings {
  type?: CameraType;
  fov?: number;
  near?: number;
  far?: number;
  /** 相机控制器的目标点（用于保存/恢复视角） */
  target?: [number, number, number];
}

export interface SceneObjectData {
  id: string;
  name?: string;
  type: 'mesh' | 'model' | 'pointCloud' | 'light' | 'camera' | 'group' | 'empty' | 'helper' | 'scene';

  /**
   * Reference to an external asset (not full data).
   */
  assetId?: string;

  /**
   * Mesh configuration when the type is `mesh`.
   */
  mesh?: {
    geometry: GeometryData;
    material: MaterialData;
  };

  /**
   * Helper configuration when the type is `helper`.
   */
  helper?: HelperData;

  /**
   * Scene configuration when the type is `scene`.
   */
  scene?: SceneSettings;

  /**
   * Camera configuration when the type is `camera`.
   */
  camera?: CameraSettings;

  /**
   * Core transform (always stored).
   */
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };

  // ==================== Render state ====================

  /**
   * Whether the object is visible.
   * @default true
   */
  visible?: boolean;

  /**
   * Whether the object casts shadows.
   * @default true
   */
  castShadow?: boolean;

  /**
   * Whether the object receives shadows.
   * @default true
   */
  receiveShadow?: boolean;

  /**
   * Whether frustum culling is enabled.
   * @default true
   */
  frustumCulled?: boolean;

  /**
   * Render order; larger renders later.
   * @default 0
   */
  renderOrder?: number;

  /**
   * Whether the object can be selected via raycast.
   * @default true
   */
  selectable?: boolean;

  /**
   * Parent object ID.
   */
  parentId?: string;

  /**
   * Child object ID list.
   */
  childrenIds?: string[];

  // ==================== User data ====================

  userData?: Record<string, any>;
}
